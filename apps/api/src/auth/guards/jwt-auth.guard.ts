import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { PUBLIC_METADATA } from '@/access';

import { TokenService } from '../token.service';

/** Shape written onto `req.user`. `ContextGuard` reads it next to load the
 * subject; downstream handlers can pull the id via `@CurrentUser()`. */
export interface AuthenticatedUser {
  id: string;
}

/** Runs first in the guard chain. Verifies `Authorization: Bearer <jwt>`,
 * populates `req.user`. Marks routes as public by looking for the
 * `@Public()` metadata key — see `access/requires.decorator.ts` for the
 * one place that key is defined. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_METADATA, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<Request>();
    const header = req.headers.authorization ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      throw new UnauthorizedException({ code: 'ACCESS_MISSING' });
    }

    const { userId } = await this.tokens.verifyAccessToken(token);
    req.user = { id: userId };
    return true;
  }
}
