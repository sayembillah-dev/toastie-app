import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import type { RequestContext } from './context.guard';

/** Handler-side sugar for `req.ctx` — the subject + resolved context
 * `ContextGuard` writes on every non-`@Public()` request. Non-null
 * because `ContextGuard` runs before any handler that uses this decorator. */
export const CurrentContext = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestContext => {
    const req = ctx.switchToHttp().getRequest<Request>();
    if (!req.ctx) {
      throw new Error('CurrentContext used on a route without ContextGuard');
    }
    return req.ctx;
  },
);
