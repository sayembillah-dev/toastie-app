import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import { CurrentContext, type RequestContext, Requires } from '@/access';
import { type MemberWire } from '@/memberships';

import { CreateSpeechSlotRequestDto, StartPathwayDto } from './dto/education.dto';
import { EducationService } from './education.service';
import type {
  AhCounterEntryWire,
  EvaluationWire,
  HistoryEventWire,
  MemberStatsWire,
  SpeechSlotRequestWire,
  TimerEntryWire,
} from './serializers';

/** URL layout mirrors the local-db routes so no client change is needed
 * when the flag flips: `/members/:memberId/{history,stats,pathway,…}`.
 * Kept under the education module since the resource key on every route
 * is `education`, `evaluation`, or `speechRequest`. */
@Controller('members/:memberId')
export class EducationController {
  constructor(private readonly education: EducationService) {}

  @Requires('education', 'read')
  @Get('history')
  history(
    @CurrentContext() ctx: RequestContext,
    @Param('memberId') memberId: string,
  ): Promise<HistoryEventWire[]> {
    return this.education.listHistory(ctx.subject, memberId);
  }

  @Requires('education', 'read')
  @Get('stats')
  stats(
    @CurrentContext() ctx: RequestContext,
    @Param('memberId') memberId: string,
  ): Promise<MemberStatsWire> {
    return this.education.getStats(ctx.subject, memberId);
  }

  /* Coarse gate stays at `read` (every club member has it club-wide): a
   * member may start or update their OWN pathway, and ownership isn't known
   * until the membership row loads — `EducationService.startPathway`
   * re-checks `education:update` with `ownerMembershipId` set. */
  @Requires('education', 'read')
  @Post('pathway')
  startPathway(
    @CurrentContext() ctx: RequestContext,
    @Param('memberId') memberId: string,
    @Body() dto: StartPathwayDto,
  ): Promise<MemberWire> {
    return this.education.startPathway(ctx.subject, memberId, dto);
  }

  /* Coarse gate is `education:read` (every club member has it club-wide):
   * `evaluation:read` is `own`-scoped for plain members, which the
   * pre-handler gate can't see — the service re-checks `evaluation:read`
   * with the loaded membership as `ownerMembershipId`, so a member reads
   * their own reports and only VPE/Admin read anyone's. */
  @Requires('education', 'read')
  @Get('evaluations')
  evaluations(
    @CurrentContext() ctx: RequestContext,
    @Param('memberId') memberId: string,
  ): Promise<EvaluationWire[]> {
    return this.education.listEvaluations(ctx.subject, memberId);
  }

  @Requires('education', 'read') // two-phase — see `evaluations` above
  @Get('timer-entries')
  timerEntries(
    @CurrentContext() ctx: RequestContext,
    @Param('memberId') memberId: string,
  ): Promise<TimerEntryWire[]> {
    return this.education.listTimerEntries(ctx.subject, memberId);
  }

  @Requires('education', 'read') // two-phase — see `evaluations` above
  @Get('ah-counter-entries')
  ahCounterEntries(
    @CurrentContext() ctx: RequestContext,
    @Param('memberId') memberId: string,
  ): Promise<AhCounterEntryWire[]> {
    return this.education.listAhCounterEntries(ctx.subject, memberId);
  }

  /* Two-phase like `pathway`: `speechRequest:read` is `own`-scoped for
   * plain members (the Me page lists the caller's own requests), so the
   * coarse gate uses club-wide `education:read` and the service re-checks
   * `speechRequest:read` with `ownerMembershipId` set. */
  @Requires('education', 'read')
  @Get('speech-slot-requests')
  speechSlotRequests(
    @CurrentContext() ctx: RequestContext,
    @Param('memberId') memberId: string,
  ): Promise<SpeechSlotRequestWire[]> {
    return this.education.listSpeechSlotRequests(ctx.subject, memberId);
  }

  /* A member requests a slot for themselves (`speechRequest:create` is
   * `own`-scoped in MEMBER_ROLE) — the coarse gate can't see that, so it
   * stays at club-wide `education:read` and `EducationService`
   * re-checks `create` with the URL membership as `ownerMembershipId`.
   * VPE/ClubAdmin pass on their club-scoped grant as before. */
  @Requires('education', 'read')
  @Post('speech-slot-requests')
  createSpeechSlotRequest(
    @CurrentContext() ctx: RequestContext,
    @Param('memberId') memberId: string,
    @Body() dto: CreateSpeechSlotRequestDto,
  ): Promise<SpeechSlotRequestWire> {
    return this.education.createSpeechSlotRequest(ctx.subject, memberId, dto);
  }
}
