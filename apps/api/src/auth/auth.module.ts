import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';

import { AccessModule, ContextGuard, PermissionGuard } from '@/access';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { TokenService } from './token.service';

/** Registers the three global guards in the order they must run:
 *   1. `JwtAuthGuard`  — validates the bearer token, sets `req.user`
 *   2. `ContextGuard`  — loads subject + validates `X-Toastly-Context`
 *   3. `PermissionGuard` — reads `@Requires` and calls `can()`
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
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    JwtAuthGuard,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useExisting: ContextGuard },
    { provide: APP_GUARD, useExisting: PermissionGuard },
  ],
  exports: [AuthService, TokenService, JwtAuthGuard],
})
export class AuthModule {}
