import { Controller, Get, Param } from '@nestjs/common';

import { CurrentContext, type RequestContext } from '@/access';

import { EvaluationsService } from './evaluations.service';
import type { EvaluationSubmissionWire } from './serializers';

/** Deliberately **no** `@Requires('evaluation', 'read')` here. Base Members
 * only ever hold `evaluation:read` at `own` scope (`OWN_TASK_ACCESS` in
 * `packages/access/src/grants.ts`), and `PermissionGuard`'s coarse
 * pre-handler check builds its `Target` from the request context alone — it
 * never carries an `ownerMembershipId`, so an `own`-scope-only grant can
 * never pass it (see `matches()` in `packages/access/src/can.ts`). Unlike
 * `task`, `evaluation` has no baseline `CLUB_BASE_READ` grant to fall back
 * on, so decorating this route would 403 a member trying to view their own
 * feedback before the handler ever runs. `ContextGuard` still requires a
 * valid session; the real authorization is `EvaluationsService`'s `can()`
 * call, made once the target member (and their `clubId`) is loaded — the
 * same two-phase split `@Requires`'s own doc comment describes. */
@Controller('members/:memberId')
export class EvaluationsController {
  constructor(private readonly evaluations: EvaluationsService) {}

  @Get('received-evaluations')
  receivedEvaluations(
    @CurrentContext() ctx: RequestContext,
    @Param('memberId') memberId: string,
  ): Promise<EvaluationSubmissionWire[]> {
    return this.evaluations.listReceivedForMember(ctx.subject, memberId);
  }
}
