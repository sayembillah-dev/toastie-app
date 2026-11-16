import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';

import { AccessModule, ContextGuard, PermissionGuard } from '@/access';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EmailVerificationService } from './email-verification.service';
import { ClientIpThrottlerGuard } from './guards/client-ip-throttler.guard';
import { EmailVerifiedGuard } from './guards/email-verified.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { OtpService } from './otp.service';
import { PasswordResetService } from './password-reset.service';
import { TokenService } from './token.service';

/** Registers the four global guards in the order they must run:
 *   1. `JwtAuthGuard`  — validates the bearer token, sets `req.user`
 *   2. `ContextGuard`  — loads subject + validates `X-Toastly-Context`
 *   3. `EmailVerifiedGuard` — the "verify your email" gate; reads the
 *      session `ContextGuard` loaded
 *   4. `PermissionGuard` — reads `@Requires` and calls `can()`
 *
 * `APP_GUARD` providers run in registration order, so the array below is
 * load-bearing — reordering it breaks the assumption that later guards
 * can read what earlier ones wrote onto the request. */
@Module({
  imports: [
    AccessModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET'),
      }),
    }),
    // Storage for `ClientIpThrottlerGuard`. Not an APP_GUARD: only the public
    // auth routes opt in, each with its own `@Throttle` limit. This default
    // applies to a route that uses the guard without one.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 10 }]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    OtpService,
    PasswordResetService,
    EmailVerificationService,
    ClientIpThrottlerGuard,
    JwtAuthGuard,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useExisting: ContextGuard },
    { provide: APP_GUARD, useClass: EmailVerifiedGuard },
    { provide: APP_GUARD, useExisting: PermissionGuard },
  ],
  exports: [AuthService, TokenService, OtpService, JwtAuthGuard],
})
export class AuthModule {}
