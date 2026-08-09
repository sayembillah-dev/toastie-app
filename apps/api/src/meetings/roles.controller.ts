import { Body, Controller, Get, Param, Put } from '@nestjs/common';

import { actorMembershipIdFor, CurrentContext, type RequestContext, Requires } from '@/access';

import { SetMeetingRoleDto } from './dto/roles.dto';
import { MeetingRolesService } from './roles.service';
import { type MeetingRoleAssignmentWire } from './serializers';

@Controller('meetings/:meetingId/roles')
export class MeetingRolesController {
  constructor(private readonly roles: MeetingRolesService) {}

  @Requires('meetingRole', 'read')
  @Get()
  list(
    @CurrentContext() ctx: RequestContext,
    @Param('meetingId') meetingId: string,
  ): Promise<MeetingRoleAssignmentWire[]> {
    return this.roles.list(ctx.subject, meetingId);
  }

  @Requires('meetingRole', 'update')
  @Put(':roleKey')
  setAssignment(
    @CurrentContext() ctx: RequestContext,
    @Param('meetingId') meetingId: string,
    @Param('roleKey') roleKey: string,
    @Body() dto: SetMeetingRoleDto,
  ): Promise<MeetingRoleAssignmentWire> {
    const clubId = ctx.clubId;
    return this.roles.setAssignment(
      ctx.subject,
      meetingId,
      roleKey,
      clubId ? actorMembershipIdFor(ctx, clubId) : null,
      dto,
    );
  }
}
