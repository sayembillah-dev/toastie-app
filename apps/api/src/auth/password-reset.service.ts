import { BadRequestException, Injectable, Logger } from '@nestjs/common';

import { MailService, maskEmail, passwordChangedEmail, passwordResetCodeEmail } from '@/mail';
import { PrismaService } from '@/prisma';

import type { ResetPasswordDto } from './dto/password-reset.dto';
import { OTP_TTL_MINUTES, OtpService } from './otp.service';
import { TokenService } from './token.service';

/** Self-service password reset by email code:
 *
 *   1. `requestReset(email)` — answers at once and does the work in the
 *      background, so the response is the same, in content AND timing,
 *      whether or not an account has that email.
 *   2. `reset(dto)` — checks the code, sets the new password, signs out every
 *      device, and emails a "password changed" notice.
 *
 * Any account email can be reset, verified or not: an admin may have typed
 * it in. A correct code proves the person reads that inbox, so a successful
 * reset also marks the email verified. */
@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
    private readonly tokens: TokenService,
    private readonly mail: MailService,
  ) {}

  /** Never throws and never waits on the database or SES. */
  requestReset(email: string): void {
    void this.sendResetCode(email).catch((err: unknown) => {
      this.logger.error(
        `Reset code for ${maskEmail(email)} failed: ${(err as Error).message ?? String(err)}`,
      );
    });
  }

  async reset(dto: ResetPasswordDto): Promise<void> {
    const now = new Date();
    const verified = await this.otp.verify(
      { channel: 'email', target: dto.email, purpose: 'reset', code: dto.code },
      now,
    );
    if (!verified.ok || !verified.userId) throw invalidCode();

    // Re-read the account: the email may have moved to another account, or
    // the account been suspended, after the code went out.
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true, status: true, emailVerifiedAt: true },
    });
    if (!user || user.id !== verified.userId || user.status !== 'active') throw invalidCode();

    const passwordHash = await this.tokens.hashPassword(dto.newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          mustChangePassword: false,
          emailVerifiedAt: user.emailVerifiedAt ?? now,
        },
      }),
      // Every device, not one refresh family: whoever knew the old password
      // must be out.
      this.prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: now },
      }),
      // An admin's credential handoff carries the old password — useless now.
      this.prisma.credentialShare.deleteMany({ where: { userId: user.id } }),
    ]);

    void this.mail
      .send({ to: dto.email, ...passwordChangedEmail() })
      .catch((err: unknown) =>
        this.logger.error(
          `"Password changed" notice to ${maskEmail(dto.email)} failed: ${(err as Error).message ?? String(err)}`,
        ),
      );
  }

  private async sendResetCode(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, status: true },
    });
    // Suspended accounts cannot sign in, so a new password would not help.
    if (user?.status !== 'active') return;

    const issued = await this.otp.issue({
      channel: 'email',
      target: email,
      purpose: 'reset',
      userId: user.id,
    });
    if (!issued.ok) {
      this.logger.warn(`Reset code for ${maskEmail(email)} not sent: ${issued.reason}`);
      return;
    }
    await this.mail.send({ to: email, ...passwordResetCodeEmail(issued.code, OTP_TTL_MINUTES) });
  }
}

/** One error for every way a reset can fail, so the response never tells an
 * attacker whether the email has an account or which check failed. */
function invalidCode(): BadRequestException {
  return new BadRequestException({
    code: 'OTP_INVALID',
    message: 'The code is wrong or has expired. Ask for a new code.',
  });
}
