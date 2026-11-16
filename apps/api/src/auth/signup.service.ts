import { createHmac } from 'node:crypto';

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import { MailService, maskEmail, signupCodeEmail, signupExistingAccountEmail } from '@/mail';
import { PrismaService } from '@/prisma';

import { OTP_TTL_MINUTES, OtpService } from './otp.service';

/** Sign-up emails (codes AND "you already have an account" notices) the
 * whole system may send per hour. The sign-up route mails any address a
 * stranger types, with no account to count against, so this is the backstop
 * that keeps a flood of made-up addresses from bouncing and getting the SES
 * account paused. The trade-off: during a flood, sign-up stops for everyone
 * for up to an hour. */
const MAX_SIGNUP_EMAILS_PER_HOUR = 100;

/** How long the sign-up token stays valid after the code is checked — time
 * to fill in name, phone and password. */
const SIGNUP_TOKEN_TTL_SECONDS = 30 * 60;

interface SignupTokenPayload {
  purpose: 'signup';
  email: string;
}

/** Email-first sign-up, in three calls:
 *
 *   1. `sendCode(email)` — answers at once and works in the background. A new
 *      address gets a code. An address that already has an account gets a
 *      "you already have an account" notice instead — so the sign-up screen
 *      behaves the same for every address and cannot be used to find out
 *      who has an account.
 *   2. `verify(email, code)` — checks the code and returns a short-lived
 *      sign-up token that carries the proven email.
 *   3. `POST /auth/register` with the token — creates the account with the
 *      email already verified (see `AuthService.register`).
 *
 * The token is a JWT signed with its own key (derived from
 * `JWT_ACCESS_SECRET` under a fixed label), has no `sub`, and carries
 * `purpose: 'signup'` — so it can never pass as an access token, and an
 * access token can never pass as a sign-up token. */
@Injectable()
export class SignupService {
  private readonly logger = new Logger(SignupService.name);
  private readonly tokenSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
    private readonly mail: MailService,
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    this.tokenSecret = createHmac('sha256', config.get<string>('JWT_ACCESS_SECRET') ?? '')
      .update('openfloor/signup-token/v1')
      .digest('base64url');
  }

  /** Never throws and never waits on the database or SES. */
  requestCode(email: string): void {
    void this.sendCode(email).catch((err: unknown) => {
      this.logger.error(
        `Sign-up email to ${maskEmail(email)} failed: ${(err as Error).message ?? String(err)}`,
      );
    });
  }

  async verify(email: string, code: string): Promise<{ signupToken: string }> {
    const verified = await this.otp.verify({
      channel: 'email',
      target: email,
      purpose: 'signup',
      code,
    });
    if (!verified.ok) {
      throw new BadRequestException({
        code: 'OTP_INVALID',
        message: 'The code is wrong or has expired. Ask for a new code.',
      });
    }
    const payload: SignupTokenPayload = { purpose: 'signup', email };
    const signupToken = await this.jwt.signAsync(payload, {
      secret: this.tokenSecret,
      expiresIn: SIGNUP_TOKEN_TTL_SECONDS,
    });
    return { signupToken };
  }

  /** The proven email inside a sign-up token. One error for every failure:
   * expired, forged, or not a sign-up token at all. */
  async emailFromToken(token: string): Promise<string> {
    try {
      const payload = await this.jwt.verifyAsync<Partial<SignupTokenPayload>>(token, {
        secret: this.tokenSecret,
      });
      if (payload.purpose === 'signup' && typeof payload.email === 'string') {
        return payload.email;
      }
    } catch {
      // Falls through to the single error below.
    }
    throw new BadRequestException({
      code: 'SIGNUP_TOKEN_INVALID',
      message: 'Your sign-up session has expired. Start again with your email.',
    });
  }

  private async sendCode(email: string): Promise<void> {
    const now = new Date();
    const sentLastHour = await this.prisma.otpCode.count({
      where: { purpose: 'signup', createdAt: { gt: new Date(now.getTime() - 60 * 60_000) } },
    });
    if (sentLastHour >= MAX_SIGNUP_EMAILS_PER_HOUR) {
      this.logger.warn(
        `Sign-up email to ${maskEmail(email)} not sent: system limit of ${MAX_SIGNUP_EMAILS_PER_HOUR}/hour reached`,
      );
      return;
    }

    // A code row is made for EVERY address — also one that already has an
    // account, where the code itself is never sent. The row gives that
    // address the same cooldown and hourly limit (so the notice cannot be
    // used to flood a member's inbox), and makes a later `verify` for it take
    // the same path, and the same time, as for a new address.
    const issued = await this.otp.issue(
      { channel: 'email', target: email, purpose: 'signup' },
      now,
    );
    if (!issued.ok) {
      this.logger.warn(`Sign-up email to ${maskEmail(email)} not sent: ${issued.reason}`);
      return;
    }

    const existing = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    await this.mail.send({
      to: email,
      ...(existing ? signupExistingAccountEmail() : signupCodeEmail(issued.code, OTP_TTL_MINUTES)),
    });
  }
}
