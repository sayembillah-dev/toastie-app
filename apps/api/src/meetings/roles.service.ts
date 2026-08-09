import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { can, type PermissionSubject } from '@toastly/access';

import { ActivityService } from '@/activity';
import { PrismaService } from '@/prisma';

import type { SetMeetingRoleDto } from './dto/roles.dto';
import { type MeetingRoleAssignmentWire, toMeetingRoleAssignmentWire } from './serializers';

/** Handles `/meetings/:meetingId/roles` — who's assigned to each of the
 * fixed meeting roles (President, Toastmaster, Ah Counter, …). The role key
 * list itself is presentation-owned (`lib/meetings/roles.ts` on the web);
 * this only stores whatever key it's given against a membership. */
@Injectable()
export class MeetingRolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
  ) {}

  async list(subject: PermissionSubject, meetingId: string): Promise<MeetingRoleAssignmentWire[]> {
    const meeting = await this.requireMeeting(meetingId);
    this.assert(subject, meeting.clubId, 'read');
    const rows = await this.prisma.meetingRoleAssignment.findMany({
      where: { clubId: meeting.clubId, meetingId: meeting.id },
    });
    return rows.map(toMeetingRoleAssignmentWire);
  }

  async setAssignment(
    subject: PermissionSubject,
    meetingId: string,
    roleKey: string,
    actorMembershipId: string | null,
    dto: SetMeetingRoleDto,
  ): Promise<MeetingRoleAssignmentWire> {
    const meeting = await this.requireMeeting(meetingId);
    this.assert(subject, meeting.clubId, 'update');
    const membershipId = dto.membershipId;

    if (membershipId) {
      const member = await this.prisma.membership.findUnique({
        where: { clubId_id: { clubId: meeting.clubId, id: membershipId } },
        select: { id: true },
      });
      if (!member) throw new NotFoundException(`No member with id "${membershipId}" in this club`);
    }

    const row = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.meetingRoleAssignment.upsert({
        where: {
          clubId_meetingId_roleKey: { clubId: meeting.clubId, meetingId: meeting.id, roleKey },
        },
        create: { clubId: meeting.clubId, meetingId: meeting.id, roleKey, membershipId },
        update: { membershipId },
      });
      await this.activity.record(
        {
          clubId: meeting.clubId,
          actorMembershipId,
          category: 'meeting',
          action: membershipId ? 'assigned a meeting role' : 'cleared a meeting role',
          summary: membershipId
            ? `Assigned "${roleKey}" for Meeting ${meeting.meetingNumber}`
            : `Cleared "${roleKey}" for Meeting ${meeting.meetingNumber}`,
          entityType: 'meetingRoleAssignment',
          entityId: saved.id,
        },
        tx,
      );
      return saved;
    });
    return toMeetingRoleAssignmentWire(row);
  }

  private async requireMeeting(meetingId: string) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      select: { id: true, clubId: true, meetingNumber: true },
    });
    if (!meeting) throw new NotFoundException(`No meeting with id "${meetingId}"`);
    return meeting;
  }

  private assert(
    subject: PermissionSubject,
    clubId: string,
    action: 'read' | 'create' | 'update' | 'delete',
  ): void {
    if (!can(subject, action, 'meetingRole', { clubId })) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'meetingRole',
        action,
        reason: 'You do not manage this club',
      });
    }
  }
}
