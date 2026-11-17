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

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** The server half of the "verify your email" gate. Runs after
 * `ContextGuard`, so it reads the session that guard already loaded — no
 * extra query. `session.user.mustVerifyEmail` is false whenever
 * `EMAIL_VERIFICATION_ENFORCED` is off, so with the switch off this guard
 * never blocks anything.
 *
 * Reads (GET, HEAD, OPTIONS) always pass: the apps draw the dashboard
 * behind the "verify your email" prompt, which cannot be dismissed, so a
 * gated account may look but not change anything. Routes marked
 * `@AllowUnverifiedEmail()` pass too, so a gated client can still verify an
 * email, change its password and sign out. */
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
    if (READ_METHODS.has(req.method)) return true;
    if (req.ctx?.session.user.mustVerifyEmail) {
      throw new ForbiddenException({
        code: 'EMAIL_VERIFICATION_REQUIRED',
        message: 'Verify your email address to continue.',
      });
    }
    return true;
  }
}
