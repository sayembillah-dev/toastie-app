import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';

import { actorMembershipIdFor, CurrentContext, type RequestContext, Requires } from '@/access';
import { AttendanceService } from './attendance.service';
import {
  CreateGuestAttendanceDto,
  MarkAllAttendanceDto,
  SetMemberAttendanceDto,
  UpdateGuestAttendanceDto,
} from './dto/attendance.dto';
import { type MeetingAttendanceWire, type MeetingGuestAttendanceWire } from './serializers';

@Controller('meetings/:meetingId/attendance')
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Requires('attendance', 'read')
  @Get('members')
  listMembers(
    @CurrentContext() ctx: RequestContext,
    @Param('meetingId') meetingId: string,
  ): Promise<MeetingAttendanceWire[]> {
    return this.attendance.listMembers(ctx.subject, meetingId);
  }

  @Requires('attendance', 'update')
  @Put('members/:membershipId')
  setMember(
    @CurrentContext() ctx: RequestContext,
    @Param('meetingId') meetingId: string,
    @Param('membershipId') membershipId: string,
    @Body() dto: SetMemberAttendanceDto,
  ): Promise<MeetingAttendanceWire> {
    const clubId = ctx.clubId;
    return this.attendance.setMember(
      ctx.subject,
      meetingId,
      membershipId,
      clubId ? actorMembershipIdFor(ctx, clubId) : null,
      dto,
    );
  }

  @Requires('attendance', 'update')
  @Put('mark-all')
  markAll(
    @CurrentContext() ctx: RequestContext,
    @Param('meetingId') meetingId: string,
    @Body() dto: MarkAllAttendanceDto,
  ): Promise<{ members: MeetingAttendanceWire[]; guests: MeetingGuestAttendanceWire[] }> {
    const clubId = ctx.clubId;
    return this.attendance.markAll(
      ctx.subject,
      meetingId,
      clubId ? actorMembershipIdFor(ctx, clubId) : null,
      dto,
    );
  }

  @Requires('attendance', 'read')
  @Get('guests')
  listGuests(
    @CurrentContext() ctx: RequestContext,
    @Param('meetingId') meetingId: string,
  ): Promise<MeetingGuestAttendanceWire[]> {
    return this.attendance.listGuests(ctx.subject, meetingId);
  }

  @Requires('attendance', 'create')
  @Post('guests')
  createGuest(
    @CurrentContext() ctx: RequestContext,
    @Param('meetingId') meetingId: string,
    @Body() dto: CreateGuestAttendanceDto,
  ): Promise<MeetingGuestAttendanceWire> {
    const clubId = ctx.clubId;
    return this.attendance.createGuest(
      ctx.subject,
      meetingId,
      clubId ? actorMembershipIdFor(ctx, clubId) : null,
      dto,
    );
  }

  @Requires('attendance', 'update')
  @Patch('guests/:guestId')
  updateGuest(
    @CurrentContext() ctx: RequestContext,
    @Param('meetingId') meetingId: string,
    @Param('guestId') guestId: string,
    @Body() dto: UpdateGuestAttendanceDto,
  ): Promise<MeetingGuestAttendanceWire> {
    const clubId = ctx.clubId;
    return this.attendance.updateGuest(
      ctx.subject,
      meetingId,
      guestId,
      clubId ? actorMembershipIdFor(ctx, clubId) : null,
      dto,
    );
  }

  @Requires('attendance', 'delete')
  @Delete('guests/:guestId')
  deleteGuest(
    @CurrentContext() ctx: RequestContext,
    @Param('meetingId') meetingId: string,
    @Param('guestId') guestId: string,
  ): Promise<null> {
    const clubId = ctx.clubId;
    return this.attendance.deleteGuest(
      ctx.subject,
      meetingId,
      guestId,
      clubId ? actorMembershipIdFor(ctx, clubId) : null,
    );
  }
}
