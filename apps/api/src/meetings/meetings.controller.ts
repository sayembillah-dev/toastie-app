import { BadRequestException, Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';

import { CurrentContext, type RequestContext, Requires } from '@/access';

import { CreateMeetingDto, UpdateMeetingDto } from './dto/meetings.dto';
import { MeetingsService } from './meetings.service';
import { type MeetingWire } from './serializers';

@Controller('meetings')
export class MeetingsController {
  constructor(private readonly meetings: MeetingsService) {}

  @Requires('meeting', 'read')
  @Get()
  list(@CurrentContext() ctx: RequestContext): Promise<MeetingWire[]> {
    const clubId = requireClubContext(ctx);
    return this.meetings.list(ctx.subject, clubId);
  }

  @Requires('meeting', 'read')
  @Get(':meetingId')
  get(
    @CurrentContext() ctx: RequestContext,
    @Param('meetingId') meetingId: string,
  ): Promise<MeetingWire> {
    return this.meetings.get(ctx.subject, meetingId);
  }

  @Requires('meeting', 'create')
  @Post()
  create(
    @CurrentContext() ctx: RequestContext,
    @Body() dto: CreateMeetingDto,
  ): Promise<MeetingWire> {
    const clubId = requireClubContext(ctx);
    return this.meetings.create(ctx.subject, clubId, dto);
  }

  @Requires('meeting', 'update')
  @Patch(':meetingId')
  update(
    @CurrentContext() ctx: RequestContext,
    @Param('meetingId') meetingId: string,
    @Body() dto: UpdateMeetingDto,
  ): Promise<MeetingWire> {
    return this.meetings.update(ctx.subject, meetingId, dto);
  }
}

/** Every `/meetings` route is club-scoped — the roster only makes sense
 * inside a club context. Reject org/global contexts here rather than at
 * every service method. */
function requireClubContext(ctx: RequestContext): string {
  if (!ctx.clubId) {
    throw new BadRequestException({
      code: 'CLUB_CONTEXT_REQUIRED',
      message: 'Meetings are only accessible from a club context',
    });
  }
  return ctx.clubId;
}
