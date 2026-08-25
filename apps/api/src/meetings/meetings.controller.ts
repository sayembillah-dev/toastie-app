import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';

import { CurrentContext, type RequestContext, Requires } from '@/access';

import { CreateMeetingDto, SaveMeetingRoleStateDto, UpdateMeetingDto } from './dto/meetings.dto';
import { MeetingsService } from './meetings.service';
import { type MeetingRoleStateWire, type MeetingWire } from './serializers';

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

  /** Live role capture state (Ah Counter/Timer/Grammarian) — see the service
   * for why the write side gates on `meeting:read` rather than `update`. */
  @Requires('meeting', 'read')
  @Get(':meetingId/role-state/:kind')
  getRoleState(
    @CurrentContext() ctx: RequestContext,
    @Param('meetingId') meetingId: string,
    @Param('kind') kind: string,
  ): Promise<MeetingRoleStateWire> {
    return this.meetings.getRoleState(ctx.subject, meetingId, kind);
  }

  @Requires('meeting', 'read')
  @Put(':meetingId/role-state/:kind')
  saveRoleState(
    @CurrentContext() ctx: RequestContext,
    @Param('meetingId') meetingId: string,
    @Param('kind') kind: string,
    @Body() dto: SaveMeetingRoleStateDto,
  ): Promise<MeetingRoleStateWire> {
    return this.meetings.saveRoleState(ctx.subject, meetingId, kind, dto.state);
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

  @Requires('meeting', 'delete')
  @Delete(':meetingId')
  delete(
    @CurrentContext() ctx: RequestContext,
    @Param('meetingId') meetingId: string,
  ): Promise<null> {
    return this.meetings.delete(ctx.subject, meetingId);
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
