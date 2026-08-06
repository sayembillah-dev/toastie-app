import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { explain, type Target } from '@toastly/access';
import type { Request } from 'express';

import { PUBLIC_METADATA, REQUIRES_METADATA, type RequiresMetadata } from './requires.decorator';

/** Reads `@Requires(resource, action)` on the handler and runs the coarse
 * check against the subject `ContextGuard` populated on `req.ctx`. Routes
 * without `@Requires` fall through — those are auth-only endpoints like
 * `/auth/session` and `/auth/logout`. Domain routes must set it explicitly
 * or they get default-deny on the next slice, per §5.2 of the plan. */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(execCtx: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_METADATA, [
      execCtx.getHandler(),
      execCtx.getClass(),
    ]);
    if (isPublic) return true;

    const requires = this.reflector.getAllAndOverride<RequiresMetadata | undefined>(
      REQUIRES_METADATA,
      [execCtx.getHandler(), execCtx.getClass()],
    );
    if (!requires) return true;

    const req = execCtx.switchToHttp().getRequest<Request>();
    const ctx = req.ctx;
    if (!ctx) {
      throw new ForbiddenException({
        code: 'CONTEXT_MISSING',
        message: 'ContextGuard did not run before PermissionGuard',
      });
    }

    const target: Target = {
      clubId: ctx.lineage.clubId ?? ctx.clubId ?? undefined,
      areaId: ctx.lineage.areaId,
      divisionId: ctx.lineage.divisionId,
      districtId: ctx.lineage.districtId,
      lineage: ctx.lineage,
    };

    const decision = explain(ctx.subject, requires.action, requires.resource, target);
    if (!decision.allowed) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: requires.resource,
        action: requires.action,
        reason: decision.reason,
      });
    }
    return true;
  }
}
