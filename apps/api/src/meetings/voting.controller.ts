import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';

import { CurrentContext, type RequestContext, Requires } from '@/access';

import { SetVoteCandidatesDto } from './dto/voting.dto';
import type { MeetingVoteResultsWire, MeetingVoteSetupWire } from './voting';
import { VotingService } from './voting.service';

/** The Voting tab's endpoints — ballot setup and the live tally. All nested
 * under the meeting they belong to; reads gate on `meeting:read`, edits on
 * `meeting:update` (same split as the rest of the meeting's modules). */
@Controller('meetings/:meetingId/vote')
export class MeetingVotingController {
  constructor(private readonly voting: VotingService) {}

  @Requires('meeting', 'read')
  @Get('candidates')
  listCandidates(
    @CurrentContext() ctx: RequestContext,
    @Param('meetingId') meetingId: string,
  ): Promise<MeetingVoteSetupWire> {
    return this.voting.listCandidates(ctx.subject, meetingId);
  }

  /** "Sync from meeting data" — tops the candidate lists up from speakers,
   * evaluators, attendees and role holders. Never removes anything. */
  @Requires('meeting', 'update')
  @Post('candidates/sync')
  syncCandidates(
    @CurrentContext() ctx: RequestContext,
    @Param('meetingId') meetingId: string,
  ): Promise<MeetingVoteSetupWire> {
    return this.voting.syncCandidates(ctx.subject, meetingId);
  }

  @Requires('meeting', 'update')
  @Put('candidates/:category')
  setCategoryCandidates(
    @CurrentContext() ctx: RequestContext,
    @Param('meetingId') meetingId: string,
    @Param('category') category: string,
    @Body() dto: SetVoteCandidatesDto,
  ): Promise<MeetingVoteSetupWire> {
    return this.voting.setCategoryCandidates(ctx.subject, meetingId, category, dto);
  }

  @Requires('meeting', 'read')
  @Get('results')
  getResults(
    @CurrentContext() ctx: RequestContext,
    @Param('meetingId') meetingId: string,
  ): Promise<MeetingVoteResultsWire> {
    return this.voting.getResults(ctx.subject, meetingId);
  }

  /** "Clear" on one award — wipes every ballot's pick in that category
   * (test votes, a re-run). Candidates stay; only the tally resets. */
  @Requires('meeting', 'update')
  @Delete('results/:category')
  clearCategoryVotes(
    @CurrentContext() ctx: RequestContext,
    @Param('meetingId') meetingId: string,
    @Param('category') category: string,
  ): Promise<{ cleared: number }> {
    return this.voting.clearCategoryVotes(ctx.subject, meetingId, category);
  }
}
