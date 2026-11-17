import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { SessionResponse } from '@toastly/access';

import { Public } from '@/access';

import { type AuthResult, AuthService } from './auth.service';
import { AllowUnverifiedEmail } from './decorators/allow-unverified-email.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { SendEmailCodeDto, VerifyEmailDto } from './dto/email-verification.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/password-reset.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { SignupSendCodeDto, SignupVerifyDto } from './dto/signup.dto';
import { WhatsappRecoveryRequestDto, WhatsappRecoveryResetDto } from './dto/whatsapp-recovery.dto';
import { EmailVerificationService } from './email-verification.service';
import { ClientIpThrottlerGuard } from './guards/client-ip-throttler.guard';
import type { AuthenticatedUser } from './guards/jwt-auth.guard';
import { PasswordResetService } from './password-reset.service';
import { SignupService } from './signup.service';
import { WhatsappRecoveryService } from './whatsapp-recovery.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly passwordReset: PasswordResetService,
    private readonly emailVerification: EmailVerificationService,
    private readonly whatsappRecovery: WhatsappRecoveryService,
    private readonly signup: SignupService,
  ) {}

  /** Public — no auth header expected. Returns the same shape as `login`
   * so a client can immediately hydrate the session slice without a
   * follow-up request. */
  @Public()
  @Post('register')
  @UseGuards(ClientIpThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  register(@Body() dto: RegisterDto): Promise<AuthResult> {
    return this.authService.register(dto);
  }

  /** Public. `{ email, password }` or `{ phone, password }` — see
   * `AuthService.login` for the error order. */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ClientIpThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  login(@Body() dto: LoginDto): Promise<AuthResult> {
    return this.authService.login(dto);
  }

  /** Public — the refresh token IS the credential here, so we skip the
   * access-token check and let the family-rotation logic in `TokenService`
   * be the sole arbiter. */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshDto): Promise<AuthResult> {
    return this.authService.refresh(dto.refreshToken);
  }

  /** Authenticated — logging out an anonymous request is a no-op that
   * shouldn't be reachable without a valid access token. Revokes only the
   * refresh token the client hands back so a user can sign out one device
   * without killing the others. */
  @Post('logout')
  @AllowUnverifiedEmail()
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() dto: RefreshDto): Promise<void> {
    await this.authService.logout(dto.refreshToken);
  }

  /** Client-side session hydrator (S5's `SessionProvider` calls this on
   * mount). Requires auth; no explicit `@Requires` because *any* signed-in
   * user is allowed to inspect their own session. */
  @Get('session')
  @AllowUnverifiedEmail()
  session(@CurrentUser() user: AuthenticatedUser): Promise<SessionResponse> {
    return this.authService.loadSession(user.id);
  }

  /** Self-service rotation — see `AuthService.changePassword` for how this
   * differs from the admin-driven `POST /users/:userId/password`. */
  @Patch('password')
  @AllowUnverifiedEmail()
  @HttpCode(HttpStatus.NO_CONTENT)
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    return this.authService.changePassword(user.id, dto);
  }

  /** Public. Always `202` with the same body, whether or not the email has an
   * account — the code is sent in the background (see
   * `PasswordResetService.requestReset`). */
  @Public()
  @Post('password/forgot')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(ClientIpThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  forgotPassword(@Body() dto: ForgotPasswordDto): { ok: true } {
    this.passwordReset.requestReset(dto.email);
    return { ok: true };
  }

  /** Public. `204` on success; `400 OTP_INVALID` for every failure. Does not
   * sign the person in — every session was just revoked, so the client sends
   * them to the sign-in page with the new password. */
  @Public()
  @Post('password/reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(ClientIpThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    return this.passwordReset.reset(dto);
  }

  /** Signed-in. Emails a 6-digit code to `email`; nothing on the account
   * changes yet. `202` on success. No password: the signed-in session is
   * enough (`currentPassword` from older builds is ignored). Errors:
   * `409 EMAIL_TAKEN` / `EMAIL_ALREADY_VERIFIED`, `429 OTP_COOLDOWN` /
   * `OTP_LIMIT`, `502 MAIL_SEND_FAILED`. Allowed through the email gate —
   * this is how a gated account gets out of it. */
  @Post('email/send-code')
  @AllowUnverifiedEmail()
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(ClientIpThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async sendEmailCode(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SendEmailCodeDto,
  ): Promise<{ ok: true }> {
    await this.emailVerification.sendCode(user.id, dto);
    return { ok: true };
  }

  /** Signed-in. Checks the code, then makes `email` the account's verified
   * sign-in email. Returns the fresh session (`mustVerifyEmail: false`).
   * Errors: `400 OTP_INVALID`, `409 EMAIL_TAKEN`. */
  @Post('email/verify')
  @AllowUnverifiedEmail()
  @HttpCode(HttpStatus.OK)
  @UseGuards(ClientIpThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  verifyEmail(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: VerifyEmailDto,
  ): Promise<SessionResponse> {
    return this.emailVerification.verify(user.id, dto);
  }

  /** Public. Password recovery for accounts with no verified email: sends a
   * code to the phone on WhatsApp. Always `202` with the same body, whether
   * or not the number has an account that may use it (see
   * `WhatsappRecoveryService`). */
  @Public()
  @Post('recovery/whatsapp/request')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(ClientIpThrottlerGuard)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  requestWhatsappRecovery(@Body() dto: WhatsappRecoveryRequestDto): { ok: true } {
    this.whatsappRecovery.requestCode(dto.phone);
    return { ok: true };
  }

  /** Public. Checks the WhatsApp code, sets the new password, signs out every
   * other device and signs this one in — same response as `login`. `400
   * OTP_INVALID` for every failure. With the email gate on, the session that
   * comes back asks for an email next. */
  @Public()
  @Post('recovery/whatsapp/reset')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ClientIpThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  resetWithWhatsapp(@Body() dto: WhatsappRecoveryResetDto): Promise<AuthResult> {
    return this.whatsappRecovery.reset(dto);
  }

  /** Public. Sign-up step 1: emails a code to a new address, or a "you
   * already have an account" notice to a taken one. Always `202` with the
   * same body (see `SignupService`). */
  @Public()
  @Post('signup/email/send-code')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(ClientIpThrottlerGuard)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  sendSignupCode(@Body() dto: SignupSendCodeDto): { ok: true } {
    this.signup.requestCode(dto.email);
    return { ok: true };
  }

  /** Public. Sign-up step 2: checks the code and returns `{ signupToken }`,
   * valid for 30 minutes, for `POST /auth/register`. `400 OTP_INVALID` for
   * every failure. */
  @Public()
  @Post('signup/email/verify')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ClientIpThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  verifySignupCode(@Body() dto: SignupVerifyDto): Promise<{ signupToken: string }> {
    return this.signup.verify(dto.email, dto.code);
  }
}
