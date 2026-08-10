import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { can, type PermissionSubject } from '@toastly/access';

import { ActivityService } from '@/activity';
import { syncGuestVisitStats } from '@/people/visit-stats';
import { PrismaService } from '@/prisma';

import type {
  CreateGuestAttendanceDto,
  MarkAllAttendanceDto,
  SetMemberAttendanceDto,
  UpdateGuestAttendanceDto,
} from './dto/attendance.dto';
import {
  type MeetingAttendanceWire,
  type MeetingGuestAttendanceWire,
  toMeetingAttendanceWire,
  toMeetingGuestAttendanceWire,
} from './serializers';

/** Handles `/meetings/:meetingId/attendance` — club-roster check-in plus
 * ad-hoc guest rows. A member row only exists once toggled at least once;
 * an absent row reads as "not present" on the wire, matching the tab's old
 * local-state default. */
@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
  ) {}

  async listMembers(
    subject: PermissionSubject,
    meetingId: string,
  ): Promise<MeetingAttendanceWire[]> {
    const meeting = await this.requireMeeting(meetingId);
    this.assert(subject, meeting.clubId, 'read');
    const rows = await this.prisma.meetingAttendance.findMany({
      where: { clubId: meeting.clubId, meetingId: meeting.id },
    });
    return rows.map(toMeetingAttendanceWire);
  }

  async setMember(
    subject: PermissionSubject,
    meetingId: string,
    membershipId: string,
    actorMembershipId: string | null,
    dto: SetMemberAttendanceDto,
  ): Promise<MeetingAttendanceWire> {
    const meeting = await this.requireMeeting(meetingId);
    this.assert(subject, meeting.clubId, 'update');

    const member = await this.prisma.membership.findUnique({
      where: { clubId_id: { clubId: meeting.clubId, id: membershipId } },
      select: { id: true, firstName: true, lastName: true },
    });
    if (!member) throw new NotFoundException(`No member with id "${membershipId}" in this club`);

    const row = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.meetingAttendance.upsert({
        where: {
          clubId_meetingId_membershipId: {
            clubId: meeting.clubId,
            meetingId: meeting.id,
            membershipId,
          },
        },
        create: {
          clubId: meeting.clubId,
          meetingId: meeting.id,
          membershipId,
          present: dto.present,
        },
        update: { present: dto.present },
      });
      await this.activity.record(
        {
          clubId: meeting.clubId,
          actorMembershipId,
          category: 'meeting',
          action: dto.present ? 'checked in a member' : 'checked out a member',
          summary: `${dto.present ? 'Checked in' : 'Checked out'} ${member.firstName} ${member.lastName} for Meeting ${meeting.meetingNumber}`,
          entityType: 'meetingAttendance',
          entityId: saved.id,
        },
        tx,
      );
      return saved;
    });
    return toMeetingAttendanceWire(row);
  }

  async markAll(
    subject: PermissionSubject,
    meetingId: string,
    actorMembershipId: string | null,
    dto: MarkAllAttendanceDto,
  ): Promise<{ members: MeetingAttendanceWire[]; guests: MeetingGuestAttendanceWire[] }> {
    const meeting = await this.requireMeeting(meetingId);
    this.assert(subject, meeting.clubId, 'update');

    const activeMembers = await this.prisma.membership.findMany({
      where: { clubId: meeting.clubId, status: 'active' },
      select: { id: true },
    });

    await this.prisma.$transaction(async (tx) => {
      for (const member of activeMembers) {
        await tx.meetingAttendance.upsert({
          where: {
            clubId_meetingId_membershipId: {
              clubId: meeting.clubId,
              meetingId: meeting.id,
              membershipId: member.id,
            },
          },
          create: {
            clubId: meeting.clubId,
            meetingId: meeting.id,
            membershipId: member.id,
            present: dto.present,
          },
          update: { present: dto.present },
        });
      }
      await tx.meetingGuestAttendance.updateMany({
        where: { clubId: meeting.clubId, meetingId: meeting.id },
        data: { present: dto.present, updatedAt: new Date() },
      });
      await this.activity.record(
        {
          clubId: meeting.clubId,
          actorMembershipId,
          category: 'meeting',
          action: dto.present ? 'marked everyone present' : 'cleared attendance',
          summary: `${dto.present ? 'Marked everyone present' : 'Cleared attendance'} for Meeting ${meeting.meetingNumber}`,
          entityType: 'meeting',
          entityId: meeting.id,
        },
        tx,
      );
    });

    const [members, guests] = await Promise.all([
      this.prisma.meetingAttendance.findMany({
        where: { clubId: meeting.clubId, meetingId: meeting.id },
      }),
      this.prisma.meetingGuestAttendance.findMany({
        where: { clubId: meeting.clubId, meetingId: meeting.id },
      }),
    ]);
    return {
      members: members.map(toMeetingAttendanceWire),
      guests: guests.map(toMeetingGuestAttendanceWire),
    };
  }

  async listGuests(
    subject: PermissionSubject,
    meetingId: string,
  ): Promise<MeetingGuestAttendanceWire[]> {
    const meeting = await this.requireMeeting(meetingId);
    this.assert(subject, meeting.clubId, 'read');
    const rows = await this.prisma.meetingGuestAttendance.findMany({
      where: { clubId: meeting.clubId, meetingId: meeting.id },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return rows.map(toMeetingGuestAttendanceWire);
  }

  async createGuest(
    subject: PermissionSubject,
    meetingId: string,
    actorMembershipId: string | null,
    dto: CreateGuestAttendanceDto,
  ): Promise<MeetingGuestAttendanceWire> {
    const meeting = await this.requireMeeting(meetingId);
    this.assert(subject, meeting.clubId, 'create');

    const prospect = await this.prisma.prospect.findUnique({
      where: { clubId_id: { clubId: meeting.clubId, id: dto.guestId } },
      select: { id: true, firstName: true, lastName: true },
    });
    if (!prospect) throw new BadRequestException(`No guest with id "${dto.guestId}" in this club`);

    try {
      return await this.doCreateGuest(meeting, prospect, actorMembershipId);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException({
          code: 'GUEST_ALREADY_CHECKED_IN',
          message: `${prospect.firstName} ${prospect.lastName} is already checked in to this meeting`,
        });
      }
      throw err;
    }
  }

  private async doCreateGuest(
    meeting: { id: string; clubId: string; meetingNumber: number },
    prospect: { id: string; firstName: string; lastName: string },
    actorMembershipId: string | null,
  ): Promise<MeetingGuestAttendanceWire> {
    const row = await this.prisma.$transaction(async (tx) => {
      const guest = await tx.meetingGuestAttendance.create({
        data: {
          clubId: meeting.clubId,
          meetingId: meeting.id,
          guestId: prospect.id,
          name: `${prospect.firstName} ${prospect.lastName}`.trim(),
          present: true,
        },
      });
      // First time this guest is linked to this meeting — log the visit and
      // roll it into their derived stats/stage the same way a manual visit
      // log from the guest profile does.
      const existingVisit = await tx.visitLog.findFirst({
        where: {
          clubId: meeting.clubId,
          prospectId: prospect.id,
          meetingId: meeting.id,
          origin: 'meeting',
        },
        select: { id: true },
      });
      if (!existingVisit) {
        await tx.visitLog.create({
          data: {
            clubId: meeting.clubId,
            prospectId: prospect.id,
            meetingId: meeting.id,
            origin: 'meeting',
          },
        });
        await syncGuestVisitStats(tx, prospect.id);
      }
      await this.activity.record(
        {
          clubId: meeting.clubId,
          actorMembershipId,
          category: 'meeting',
          action: 'checked in a guest',
          summary: `Checked in guest "${guest.name}" for Meeting ${meeting.meetingNumber}`,
          entityType: 'meetingGuestAttendance',
          entityId: guest.id,
        },
        tx,
      );
      return guest;
    });
    return toMeetingGuestAttendanceWire(row);
  }

  async updateGuest(
    subject: PermissionSubject,
    meetingId: string,
    guestId: string,
    actorMembershipId: string | null,
    dto: UpdateGuestAttendanceDto,
  ): Promise<MeetingGuestAttendanceWire> {
    const meeting = await this.requireMeeting(meetingId);
    this.assert(subject, meeting.clubId, 'update');
    const existing = await this.prisma.meetingGuestAttendance.findUnique({
      where: { id: guestId },
    });
    if (!existing || existing.meetingId !== meeting.id) {
      throw new NotFoundException(`No guest with id "${guestId}"`);
    }

    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.meetingGuestAttendance.update({
        where: { id: guestId },
        data: {
          updatedAt: new Date(),
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.present !== undefined ? { present: dto.present } : {}),
        },
      });
      // Only a check-in/out toggle is audit-worthy — a name correction isn't.
      if (dto.present !== undefined && dto.present !== existing.present) {
        await this.activity.record(
          {
            clubId: meeting.clubId,
            actorMembershipId,
            category: 'meeting',
            action: dto.present ? 'checked in a guest' : 'checked out a guest',
            summary: `${dto.present ? 'Checked in' : 'Checked out'} guest "${updated.name}" for Meeting ${meeting.meetingNumber}`,
            entityType: 'meetingGuestAttendance',
            entityId: updated.id,
          },
          tx,
        );
      }
      return updated;
    });
    return toMeetingGuestAttendanceWire(row);
  }

  async deleteGuest(
    subject: PermissionSubject,
    meetingId: string,
    guestId: string,
    actorMembershipId: string | null,
  ): Promise<null> {
    const meeting = await this.requireMeeting(meetingId);
    this.assert(subject, meeting.clubId, 'delete');
    const existing = await this.prisma.meetingGuestAttendance.findUnique({
      where: { id: guestId },
    });
    if (!existing || existing.meetingId !== meeting.id) {
      throw new NotFoundException(`No guest with id "${guestId}"`);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.meetingGuestAttendance.delete({ where: { id: guestId } });
      // Unwind the auto-logged visit this check-in created, so removing a
      // mis-added guest doesn't leave a phantom meeting on their record.
      if (existing.guestId) {
        const autoLog = await tx.visitLog.findFirst({
          where: {
            clubId: meeting.clubId,
            prospectId: existing.guestId,
            meetingId: meeting.id,
            origin: 'meeting',
          },
          select: { id: true },
        });
        if (autoLog) {
          await tx.visitLog.delete({ where: { id: autoLog.id } });
          await syncGuestVisitStats(tx, existing.guestId);
        }
      }
      await this.activity.record(
        {
          clubId: meeting.clubId,
          actorMembershipId,
          category: 'meeting',
          action: 'removed a guest',
          summary: `Removed guest "${existing.name}" from Meeting ${meeting.meetingNumber}`,
          entityType: 'meetingGuestAttendance',
          entityId: existing.id,
        },
        tx,
      );
    });
    return null;
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
    if (!can(subject, action, 'attendance', { clubId })) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'attendance',
        action,
        reason: 'You do not manage this club',
      });
    }
  }
}
