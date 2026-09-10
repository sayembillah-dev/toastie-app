import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';

import { Public } from '@/access';

import { SubmitPublicVoteDto } from './dto/voting.dto';
import type { PublicMeetingVoteWire } from './voting';
import { VotingService } from './voting.service';

/** The anonymous ballot behind the meeting's share link — same trust
 * boundary as `PublicEvaluationsController`: `@Public()` skips both
 * `JwtAuthGuard` and `ContextGuard`; the `?t=` share token is the credential
 * and is re-checked on every call. `?v=` carries the voter's
 * browser-generated key so a revisit can prefill (and a resubmit replace)
 * their earlier ballot — it identifies a device, never a person. */
@Public()
@Controller('public/meetings/:meetingId/vote')
export class PublicVotingController {
  constructor(private readonly voting: VotingService) {}

  @Get()
  ballot(
    @Param('meetingId') meetingId: string,
    @Query('t') token: string | undefined,
    @Query('v') voterKey: string | undefined,
  ): Promise<PublicMeetingVoteWire> {
    return this.voting.getPublicBallot(meetingId, token, voterKey);
  }

  @Post()
  submit(
    @Param('meetingId') meetingId: string,
    @Query('t') token: string | undefined,
    @Body() dto: SubmitPublicVoteDto,
  ): Promise<{ id: string }> {
    return this.voting.submitPublicBallot(meetingId, token, dto);
  }
}
