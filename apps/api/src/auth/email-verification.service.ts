import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { SessionResponse } from '@toastly/access';

import { SubjectFactory } from '@/access';
import { IdentityService } from '@/identity';
import { emailChangedEmail, emailVerificationCodeEmail, MailService, maskEmail } from '@/mail';
import { PrismaService } from '@/prisma';

import type { SendEmailCodeDto, VerifyEmailDto } from './dto/email-verification.dto';
import { OTP_TTL_MINUTES, OtpService } from './otp.service';
import { TokenService } from './token.service';

/** Codes one account may request per hour, across every address it tries.
 * `OtpService` limits per address; this limits per account, so one signed-in
 * member cannot use Openfloor to mail codes to a long list of strangers
 * (which would also hurt the SES sending reputation). */
const MAX_CODES_PER_USER_PER_HOUR = 10;

/** A signed-in account holder proves they read an inbox, and that address
 * becomes their verified sign-in email:
 *
 *   1. `sendCode` — checks the password, then emails a code to the address.
 *      The address is NOT written to the account yet, so a typo or a
 *      half-finished attempt never replaces a working email.
 *   2. `verify` — checks the code, then writes the address and
 *      `emailVerifiedAt` together.
 *
 * Both routes are signed-in only, so unlike the public reset flow they may
 * return precise errors (taken, cooldown, limit): the only person who sees
 * them is the account holder. */
@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
    private readonly tokens: TokenService,
    private readonly mail: MailService,
    private readonly identity: IdentityService,
    private readonly subjectFactory: SubjectFactory,
  ) {}

  async sendCode(userId: string, dto: SendEmailCodeDto): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true, email: true, emailVerifiedAt: true },
    });
    if (!user) throw new UnauthorizedException({ code: 'SESSION_INVALID' });

    const passwordOk = await this.tokens.verifyPassword(user.passwordHash, dto.currentPassword);
    if (!passwordOk) throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS' });

    if (user.emailVerifiedAt && user.email?.toLowerCase() === dto.email) {
      throw new ConflictException({
        code: 'EMAIL_ALREADY_VERIFIED',
        message: 'This email is already verified on your account.',
      });
    }
    await this.assertEmailFree(dto.email, userId);

    const now = new Date();
    const sentLastHour = await this.prisma.otpCode.count({
      where: {
        userId,
        purpose: 'verify_email',
        createdAt: { gt: new Date(now.getTime() - 60 * 60_000) },
      },
    });
    if (sentLastHour >= MAX_CODES_PER_USER_PER_HOUR) throw tooManyCodes('limit');

    const issued = await this.otp.issue(
      { channel: 'email', target: dto.email, purpose: 'verify_email', userId },
      now,
    );
    if (!issued.ok) throw tooManyCodes(issued.reason);

    try {
      await this.mail.send({
        to: dto.email,
        ...emailVerificationCodeEmail(issued.code, OTP_TTL_MINUTES),
      });
    } catch (err) {
      this.logger.error(
        `Verification code to ${maskEmail(dto.email)} failed: ${(err as Error).message ?? String(err)}`,
      );
      throw new BadGatewayException({
        code: 'MAIL_SEND_FAILED',
        message: 'We could not send the email. Try again in a few minutes.',
      });
    }
  }

  /** Returns the fresh session, so the client can drop the gate at once. */
  async verify(userId: string, dto: VerifyEmailDto): Promise<SessionResponse> {
    const now = new Date();
    const verified = await this.otp.verify(
      { channel: 'email', target: dto.email, purpose: 'verify_email', code: dto.code, userId },
      now,
    );
    // The code must have been issued to THIS account. The `userId` filter
    // above means another member's attempt finds no row, so it can neither
    // finish nor burn this verification. The check below is a second guard.
    if (!verified.ok || verified.userId !== userId) {
      throw new BadRequestException({
        code: 'OTP_INVALID',
        message: 'The code is wrong or has expired. Ask for a new code.',
      });
    }

    const before = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, emailVerifiedAt: true },
    });
    if (!before) throw new UnauthorizedException({ code: 'SESSION_INVALID' });

    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: { email: dto.email, emailVerifiedAt: now },
      });
    } catch (err) {
      // Another account took the address between `sendCode` and now.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw emailTaken();
      }
      throw err;
    }

    // Same as every other email write: keep the identity/roster copies in
    // step with the account.
    await this.identity.syncUserProfile(userId);

    // The sign-in email moved away from a verified address: tell the old
    // inbox, in case this was not the account holder.
    const oldEmail = before.email;
    if (before.emailVerifiedAt && oldEmail && oldEmail.toLowerCase() !== dto.email) {
      void this.mail
        .send({ to: oldEmail, ...emailChangedEmail(maskEmail(dto.email)) })
        .catch((err: unknown) =>
          this.logger.error(
            `"Email changed" notice to ${maskEmail(oldEmail)} failed: ${(err as Error).message ?? String(err)}`,
          ),
        );
    }

    const session = await this.subjectFactory.loadSession(userId, now.getTime());
    if (!session) throw new UnauthorizedException({ code: 'SESSION_INVALID' });
    return session;
  }

  private async assertEmailFree(email: string, userId: string): Promise<void> {
    const owner = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (owner && owner.id !== userId) throw emailTaken();
  }
}

function emailTaken(): ConflictException {
  return new ConflictException({
    code: 'EMAIL_TAKEN',
    message: 'Another account uses this email.',
  });
}

function tooManyCodes(reason: 'cooldown' | 'limit'): HttpException {
  return new HttpException(
    reason === 'cooldown'
      ? { code: 'OTP_COOLDOWN', message: 'Wait one minute, then ask for a new code.' }
      : { code: 'OTP_LIMIT', message: 'Too many codes. Try again later.' },
    HttpStatus.TOO_MANY_REQUESTS,
  );
}
