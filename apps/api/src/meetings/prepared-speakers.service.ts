import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { can, type PermissionSubject } from '@toastly/access';

import { ActivityService } from '@/activity';
import { PrismaService } from '@/prisma';

import type {
  CreatePreparedSpeakerDto,
  ReorderPreparedSpeakersDto,
  UpdatePreparedSpeakerDto,
} from './dto/prepared-speakers.dto';
import { syncPlannerSpeakersFromMeeting } from './planner-mirror';
import { type PreparedSpeakerWire, toPreparedSpeakerWire } from './serializers';

/** Handles `/meetings/:meetingId/prepared-speakers` — the Prepared Speakers
 * tab's speech slots. Gated by `meetingRole` (same roles that manage the
 * Roles tab manage this) rather than a dedicated resource key. A meeting can
 * hold any number of slots, ordered from 1 up; the planner's Speaker 1–4
 * columns seed and mirror the first four, the rest live on the meeting only. */
@Injectable()
export class PreparedSpeakersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
  ) {}

  async list(subject: PermissionSubject, meetingId: string): Promise<PreparedSpeakerWire[]> {
    const meeting = await this.requireMeeting(meetingId);
    this.assert(subject, meeting.clubId, 'read');
    const rows = await this.prisma.meetingSpeaker.findMany({
      where: { clubId: meeting.clubId, meetingId: meeting.id },
      orderBy: { order: 'asc' },
      include: { _count: { select: { evaluationSubmissions: true } } },
    });
    return rows.map(toPreparedSpeakerWire);
  }

  async create(
    subject: PermissionSubject,
    meetingId: string,
    actorMembershipId: string | null,
    _dto: CreatePreparedSpeakerDto,
  ): Promise<PreparedSpeakerWire> {
    const meeting = await this.requireMeeting(meetingId);
    this.assert(subject, meeting.clubId, 'create');

    /* No cap on speakers per meeting — the slot takes the lowest free order,
     * so a deletion in the middle is filled back in before the count grows. */
    const existing = await this.prisma.meetingSpeaker.findMany({
      where: { clubId: meeting.clubId, meetingId: meeting.id },
      select: { order: true },
    });
    const taken = new Set(existing.map((row) => row.order));
    let order = 1;
    while (taken.has(order)) order += 1;

    const row = await this.prisma.$transaction(async (tx) => {
      const speaker = await tx.meetingSpeaker.create({
        data: { clubId: meeting.clubId, meetingId: meeting.id, order },
      });
      await this.activity.record(
        {
          clubId: meeting.clubId,
          actorMembershipId,
          category: 'meeting',
          action: 'added a prepared speaker',
          summary: `Added a prepared speaker slot for Meeting ${meeting.meetingNumber}`,
          entityType: 'meetingSpeaker',
          entityId: speaker.id,
        },
        tx,
      );
      return speaker;
    });
    return toPreparedSpeakerWire(row);
  }

  async update(
    subject: PermissionSubject,
    meetingId: string,
    speakerId: string,
    actorMembershipId: string | null,
    dto: UpdatePreparedSpeakerDto,
  ): Promise<PreparedSpeakerWire> {
    const meeting = await this.requireMeeting(meetingId);
    this.assert(subject, meeting.clubId, 'update');
    const existing = await this.prisma.meetingSpeaker.findUnique({ where: { id: speakerId } });
    if (!existing || existing.meetingId !== meeting.id) {
      throw new NotFoundException(`No prepared speaker with id "${speakerId}"`);
    }

    const data: Prisma.MeetingSpeakerUncheckedUpdateInput = { updatedAt: new Date() };

    /* A guest pick clears the matching member pick and vice versa — mutually
     * exclusive on the wire, same convention as `MeetingRolesService`. Only
     * touched when the caller actually sent one of the pair. */
    if (dto.membershipId !== undefined || dto.guestId !== undefined) {
      const membershipId = dto.guestId ? null : (dto.membershipId ?? null);
      const guestId = dto.membershipId ? null : (dto.guestId ?? null);
      if (membershipId) await this.requireMember(meeting.clubId, membershipId);
      if (guestId) await this.requireGuest(meeting.clubId, guestId);
      data.membershipId = membershipId;
      data.guestId = guestId;
    }
    if (dto.evaluatorMembershipId !== undefined || dto.evaluatorGuestId !== undefined) {
      const evaluatorMembershipId = dto.evaluatorGuestId
        ? null
        : (dto.evaluatorMembershipId ?? null);
      const evaluatorGuestId = dto.evaluatorMembershipId ? null : (dto.evaluatorGuestId ?? null);
      if (evaluatorMembershipId) await this.requireMember(meeting.clubId, evaluatorMembershipId);
      if (evaluatorGuestId) await this.requireGuest(meeting.clubId, evaluatorGuestId);
      data.evaluatorMembershipId = evaluatorMembershipId;
      data.evaluatorGuestId = evaluatorGuestId;
    }
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.duration !== undefined) data.duration = dto.duration;
    if (dto.pathway !== undefined) data.pathway = dto.pathway;
    if (dto.project !== undefined) data.project = dto.project;
    if (dto.notes !== undefined) data.notes = dto.notes?.trim() || null;

    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.meetingSpeaker.update({ where: { id: speakerId }, data });
      await syncPlannerSpeakersFromMeeting(tx, meeting.clubId, meeting.id);
      return updated;
    });

    if (dto.status !== undefined && dto.status !== existing.status) {
      await this.activity.record({
        clubId: meeting.clubId,
        actorMembershipId,
        category: 'meeting',
        action: 'updated a prepared speaker',
        summary: `Marked a prepared speaker "${dto.status}" for Meeting ${meeting.meetingNumber}`,
        entityType: 'meetingSpeaker',
        entityId: row.id,
      });
    }
    return toPreparedSpeakerWire(row);
  }

  /** Bulk-renumbers the slots from the tab's move up/down controls. The whole
   * lineup is submitted each time so the server, not the client, owns the
   * final `order` sequence — and the agenda, the public page, and the
   * planner's Speaker 1–4 mirror all follow it. */
  async reorder(
    subject: PermissionSubject,
    meetingId: string,
    actorMembershipId: string | null,
    dto: ReorderPreparedSpeakersDto,
  ): Promise<PreparedSpeakerWire[]> {
    const meeting = await this.requireMeeting(meetingId);
    this.assert(subject, meeting.clubId, 'update');

    const existing = await this.prisma.meetingSpeaker.findMany({
      where: { clubId: meeting.clubId, meetingId: meeting.id },
      select: { id: true },
    });
    const known = new Set(existing.map((row) => row.id));
    const submitted = new Set(dto.speakerIds);
    if (
      submitted.size !== dto.speakerIds.length ||
      submitted.size !== known.size ||
      dto.speakerIds.some((id) => !known.has(id))
    ) {
      throw new BadRequestException(
        'speakerIds must list every prepared speaker of this meeting exactly once',
      );
    }

    /* @@unique([clubId, meetingId, order]) forbids two rows sharing an order
     * even mid-transaction, so renumber in two passes: park every row at a
     * scratch (negative) order first, then land each at its final position. */
    await this.prisma.$transaction(async (tx) => {
      for (const [index, id] of dto.speakerIds.entries()) {
        await tx.meetingSpeaker.update({ where: { id }, data: { order: -(index + 1) } });
      }
      for (const [index, id] of dto.speakerIds.entries()) {
        await tx.meetingSpeaker.update({
          where: { id },
          data: { order: index + 1, updatedAt: new Date() },
        });
      }
      await syncPlannerSpeakersFromMeeting(tx, meeting.clubId, meeting.id);
      await this.activity.record(
        {
          clubId: meeting.clubId,
          actorMembershipId,
          category: 'meeting',
          action: 'reordered prepared speakers',
          summary: `Reordered the prepared speakers for Meeting ${meeting.meetingNumber}`,
          entityType: 'meeting',
          entityId: meeting.id,
        },
        tx,
      );
    });

    return this.list(subject, meetingId);
  }

  async delete(
    subject: PermissionSubject,
    meetingId: string,
    speakerId: string,
    actorMembershipId: string | null,
  ): Promise<null> {
    const meeting = await this.requireMeeting(meetingId);
    this.assert(subject, meeting.clubId, 'delete');
    const existing = await this.prisma.meetingSpeaker.findUnique({ where: { id: speakerId } });
    if (!existing || existing.meetingId !== meeting.id) {
      throw new NotFoundException(`No prepared speaker with id "${speakerId}"`);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.meetingSpeaker.delete({ where: { id: speakerId } });
      await syncPlannerSpeakersFromMeeting(tx, meeting.clubId, meeting.id);
      await this.activity.record(
        {
          clubId: meeting.clubId,
          actorMembershipId,
          category: 'meeting',
          action: 'deleted a prepared speaker',
          summary: `Deleted a prepared speaker slot for Meeting ${meeting.meetingNumber}`,
          entityType: 'meetingSpeaker',
          entityId: existing.id,
        },
        tx,
      );
    });
    return null;
  }

  private async requireMember(clubId: string, membershipId: string): Promise<void> {
    const member = await this.prisma.membership.findUnique({
      where: { clubId_id: { clubId, id: membershipId } },
      select: { id: true },
    });
    if (!member) throw new NotFoundException(`No member with id "${membershipId}" in this club`);
  }

  private async requireGuest(clubId: string, guestId: string): Promise<void> {
    const guest = await this.prisma.prospect.findUnique({
      where: { clubId_id: { clubId, id: guestId } },
      select: { id: true },
    });
    if (!guest) throw new NotFoundException(`No guest with id "${guestId}" in this club`);
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
