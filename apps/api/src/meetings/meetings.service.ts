import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createId } from '@paralleldrive/cuid2';
import { Prisma } from '@prisma/client';
import { can, type PermissionSubject } from '@toastly/access';

import { PrismaService } from '@/prisma';

import type { CreateMeetingDto, UpdateMeetingDto } from './dto/meetings.dto';
import { MeetingNotificationsService } from './meeting-notifications.service';
import { syncPlannerFieldsFromMeeting } from './planner-mirror';
import { assertRoleStateKind, assertRoleStateSize } from './role-state';
import { type MeetingRoleStateWire, type MeetingWire, toMeetingWire } from './serializers';

/** Handles `/meetings` — the club's meeting roster. Every meeting is born
 * a draft; publishing is a separate PATCH from its own button on the
 * meeting page. */
@Injectable()
export class MeetingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: MeetingNotificationsService,
  ) {}

  async list(subject: PermissionSubject, clubId: string): Promise<MeetingWire[]> {
    if (!can(subject, 'read', 'meeting', { clubId })) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'meeting',
        action: 'read',
        reason: 'You do not manage this club',
      });
    }
    const rows = await this.prisma.meeting.findMany({
      where: { clubId },
      orderBy: { dateTime: 'asc' },
      include: {
        _count: {
          select: {
            speakers: {
              where: {
                membershipId: { not: null },
                OR: [{ status: 'delivered' }, { evaluationSubmissions: { some: {} } }],
              },
            },
          },
        },
      },
    });
    return rows.map((row) => toMeetingWire(row, row._count.speakers));
  }

  async get(subject: PermissionSubject, meetingId: string): Promise<MeetingWire> {
    const row = await this.load(meetingId);
    if (!can(subject, 'read', 'meeting', { clubId: row.clubId })) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'meeting',
        action: 'read',
        reason: 'You do not manage this club',
      });
    }
    return toMeetingWire(row);
  }

  async create(
    subject: PermissionSubject,
    clubId: string,
    dto: CreateMeetingDto,
  ): Promise<MeetingWire> {
    if (!can(subject, 'create', 'meeting', { clubId })) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'meeting',
        action: 'create',
        reason: 'You do not manage this club',
      });
    }
    try {
      const row = await this.prisma.meeting.create({
        data: {
          clubId,
          meetingNumber: dto.meetingNumber,
          dateTime: new Date(dto.dateTime),
          theme: dto.theme.trim(),
          status: 'draft',
          shareToken: createId(),
        },
      });
      return toMeetingWire(row);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException({
          code: 'MEETING_NUMBER_TAKEN',
          message: `Meeting ${dto.meetingNumber} already exists in this club`,
        });
      }
      throw err;
    }
  }

  async update(
    subject: PermissionSubject,
    meetingId: string,
    actorMembershipId: string | null,
    dto: UpdateMeetingDto,
  ): Promise<MeetingWire> {
    const existing = await this.load(meetingId);
    if (!can(subject, 'update', 'meeting', { clubId: existing.clubId })) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'meeting',
        action: 'update',
        reason: 'You do not manage this club',
      });
    }

    const data: Prisma.MeetingUpdateInput = {};
    if (dto.meetingNumber !== undefined) data.meetingNumber = dto.meetingNumber;
    if (dto.dateTime !== undefined) data.dateTime = new Date(dto.dateTime);
    if (dto.theme !== undefined) data.theme = dto.theme.trim();
    if (dto.word !== undefined) {
      const word = dto.word.word.trim();
      /* An empty word clears the whole block — a meaning or part of speech
       * with no word left to attach to is not worth keeping. */
      if (!word) {
        data.word = null;
        data.wordPartOfSpeech = null;
        data.wordMeaning = null;
        data.wordExample = null;
      } else {
        data.word = word;
        data.wordPartOfSpeech = dto.word.partOfSpeech?.trim() || null;
        data.wordMeaning = dto.word.meaning?.trim() || null;
        data.wordExample = dto.word.example?.trim() || null;
      }
    }
    if (dto.status !== undefined) {
      if (dto.status !== 'draft' && dto.status !== 'published') {
        throw new BadRequestException(`"${dto.status}" is not a meeting status`);
      }
      data.status = dto.status;
    }

    try {
      const row = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.meeting.update({ where: { id: meetingId }, data });
        if (
          dto.meetingNumber !== undefined ||
          dto.dateTime !== undefined ||
          dto.theme !== undefined
        ) {
          await syncPlannerFieldsFromMeeting(tx, existing.clubId, meetingId, {
            meetingNumber: dto.meetingNumber,
            dateTime: dto.dateTime !== undefined ? updated.dateTime : undefined,
            theme: dto.theme !== undefined ? updated.theme : undefined,
          });
        }
        return updated;
      });
      if (row.status === 'published' && existing.status !== 'published') {
        await this.announce(meetingId, actorMembershipId);
      }
      return toMeetingWire(row);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException({
          code: 'MEETING_NUMBER_TAKEN',
          message: `Meeting ${dto.meetingNumber} already exists in this club`,
        });
      }
      throw err;
    }
  }

  async delete(subject: PermissionSubject, meetingId: string): Promise<null> {
    const existing = await this.load(meetingId);
    if (!can(subject, 'delete', 'meeting', { clubId: existing.clubId })) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'meeting',
        action: 'delete',
        reason: 'You do not manage this club',
      });
    }
    await this.prisma.meeting.delete({ where: { id: meetingId } });
    return null;
  }

  /** Live Ah Counter/Timer/Grammarian capture state. Both routes gate on
   * `meeting:read` — deliberately not `meeting:update`: the member holding
   * the Timer or Ah-Counter role is usually a plain member (club-scope read
   * only), and the anonymous share-link side can write with just the meeting
   * token, so an officer-only gate would 403 exactly the people this serves.
   * The blob is stored verbatim; last write wins. */
  async getRoleState(
    subject: PermissionSubject,
    meetingId: string,
    kind: string,
  ): Promise<MeetingRoleStateWire> {
    assertRoleStateKind(kind);
    const meeting = await this.load(meetingId);
    if (!can(subject, 'read', 'meeting', { clubId: meeting.clubId })) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'meeting',
        action: 'read',
        reason: 'You do not manage this club',
      });
    }
    const row = await this.prisma.meetingRoleState.findUnique({
      where: { meetingId_kind: { meetingId, kind } },
    });
    return {
      kind,
      state: row?.state ?? null,
      updatedAt: row?.updatedAt.toISOString() ?? null,
    };
  }

  async saveRoleState(
    subject: PermissionSubject,
    meetingId: string,
    kind: string,
    state: Record<string, unknown>,
  ): Promise<MeetingRoleStateWire> {
    assertRoleStateKind(kind);
    assertRoleStateSize(state);
    const meeting = await this.load(meetingId);
    if (!can(subject, 'read', 'meeting', { clubId: meeting.clubId })) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'meeting',
        action: 'read',
        reason: 'You do not manage this club',
      });
    }
    const row = await this.prisma.meetingRoleState.upsert({
      where: { meetingId_kind: { meetingId, kind } },
      create: {
        clubId: meeting.clubId,
        meetingId,
        kind,
        state: state as Prisma.InputJsonValue,
      },
      update: { state: state as Prisma.InputJsonValue },
    });
    return { kind, state: row.state, updatedAt: row.updatedAt.toISOString() };
  }

  /** The club-wide "new meeting" message goes out on the first publish only.
   * Claiming `announcedAt` with a conditional update makes that exactly once
   * even when two publishes race across the API's cluster workers. */
  private async announce(meetingId: string, actorMembershipId: string | null): Promise<void> {
    const claimed = await this.prisma.meeting.updateMany({
      where: { id: meetingId, announcedAt: null },
      data: { announcedAt: new Date() },
    });
    if (claimed.count === 1) this.notifications.meetingPublished(meetingId, actorMembershipId);
  }

  private async load(meetingId: string) {
    const row = await this.prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!row) throw new NotFoundException(`No meeting with id "${meetingId}"`);
    return row;
  }
}
