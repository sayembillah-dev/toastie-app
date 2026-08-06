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

  @Requires('education', 'update')
  @Post('pathway')
  startPathway(
    @CurrentContext() ctx: RequestContext,
    @Param('memberId') memberId: string,
    @Body() dto: StartPathwayDto,
  ): Promise<MemberWire> {
    return this.education.startPathway(ctx.subject, memberId, dto);
  }

  @Requires('evaluation', 'read')
  @Get('evaluations')
  evaluations(
    @CurrentContext() ctx: RequestContext,
    @Param('memberId') memberId: string,
  ): Promise<EvaluationWire[]> {
    return this.education.listEvaluations(ctx.subject, memberId);
  }

  @Requires('evaluation', 'read')
  @Get('timer-entries')
  timerEntries(
    @CurrentContext() ctx: RequestContext,
    @Param('memberId') memberId: string,
  ): Promise<TimerEntryWire[]> {
    return this.education.listTimerEntries(ctx.subject, memberId);
  }

  @Requires('evaluation', 'read')
  @Get('ah-counter-entries')
  ahCounterEntries(
    @CurrentContext() ctx: RequestContext,
    @Param('memberId') memberId: string,
  ): Promise<AhCounterEntryWire[]> {
    return this.education.listAhCounterEntries(ctx.subject, memberId);
  }

  @Requires('speechRequest', 'read')
  @Get('speech-slot-requests')
  speechSlotRequests(
    @CurrentContext() ctx: RequestContext,
    @Param('memberId') memberId: string,
  ): Promise<SpeechSlotRequestWire[]> {
    return this.education.listSpeechSlotRequests(ctx.subject, memberId);
  }

  @Requires('speechRequest', 'create')
  @Post('speech-slot-requests')
  createSpeechSlotRequest(
    @CurrentContext() ctx: RequestContext,
    @Param('memberId') memberId: string,
    @Body() dto: CreateSpeechSlotRequestDto,
  ): Promise<SpeechSlotRequestWire> {
    return this.education.createSpeechSlotRequest(ctx.subject, memberId, dto);
  }
}
