import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import type { AuthenticatedUser } from '../guards/jwt-auth.guard';

/** Handler-side sugar for `req.user`. `JwtAuthGuard` guarantees this is
 * set on any non-`@Public()` route, so the return type is non-null. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const req = ctx.switchToHttp().getRequest<Request>();
    if (!req.user) {
      throw new Error('CurrentUser used on a route without JwtAuthGuard');
    }
    return req.user;
  },
);
