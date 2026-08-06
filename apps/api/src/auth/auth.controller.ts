import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import type { SessionResponse } from '@toastly/access';

import { Public } from '@/access';

import { type AuthResult, AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import type { AuthenticatedUser } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
}
