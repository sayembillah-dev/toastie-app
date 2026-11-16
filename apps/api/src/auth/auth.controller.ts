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
import { CurrentUser } from './decorators/current-user.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/password-reset.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { ClientIpThrottlerGuard } from './guards/client-ip-throttler.guard';
import type { AuthenticatedUser } from './guards/jwt-auth.guard';
import { PasswordResetService } from './password-reset.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly passwordReset: PasswordResetService,
  ) {}

  /** Public — no auth header expected. Returns the same shape as `login`
   * so a client can immediately hydrate the session slice without a
   * follow-up request. */
  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto): Promise<AuthResult> {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
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
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() dto: RefreshDto): Promise<void> {
    await this.authService.logout(dto.refreshToken);
  }

  /** Client-side session hydrator (S5's `SessionProvider` calls this on
   * mount). Requires auth; no explicit `@Requires` because *any* signed-in
   * user is allowed to inspect their own session. */
  @Get('session')
  session(@CurrentUser() user: AuthenticatedUser): Promise<SessionResponse> {
    return this.authService.loadSession(user.id);
  }

  /** Self-service rotation — see `AuthService.changePassword` for how this
   * differs from the admin-driven `POST /users/:userId/password`. */
  @Patch('password')
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
}
