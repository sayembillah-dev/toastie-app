import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { PUBLIC_METADATA } from '@/access';

import { ALLOW_UNVERIFIED_EMAIL_METADATA } from '../decorators/allow-unverified-email.decorator';

/** The server half of the "verify your email" gate. Runs after
 * `ContextGuard`, so it reads the session that guard already loaded — no
 * extra query. `session.user.mustVerifyEmail` is false whenever
 * `EMAIL_VERIFICATION_ENFORCED` is off, so with the switch off this guard
 * never blocks anything.
 *
 * Routes marked `@AllowUnverifiedEmail()` pass, so a gated client can still
 * load its session, verify an email, change its password and sign out. */
@Injectable()
export class EmailVerifiedGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(execCtx: ExecutionContext): boolean {
    const targets = [execCtx.getHandler(), execCtx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_METADATA, targets)) return true;
    if (this.reflector.getAllAndOverride<boolean>(ALLOW_UNVERIFIED_EMAIL_METADATA, targets)) {
      return true;
    }

    const req = execCtx.switchToHttp().getRequest<Request>();
    if (req.ctx?.session.user.mustVerifyEmail) {
      throw new ForbiddenException({
        code: 'EMAIL_VERIFICATION_REQUIRED',
        message: 'Verify your email address to continue.',
      });
    }
    return true;
  }
}
