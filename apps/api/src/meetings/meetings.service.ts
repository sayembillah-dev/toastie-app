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
import { type MeetingWire, toMeetingWire } from './serializers';

/** Handles `/meetings` — the club's meeting roster. Every meeting is born
 * a draft; publishing is a separate PATCH from its own button on the
 * meeting page. */
@Injectable()
export class MeetingsService {
  constructor(private readonly prisma: PrismaService) {}

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
    });
    return rows.map(toMeetingWire);
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
    if (dto.theme !== undefined) data.theme = dto.theme.trim();
    if (dto.status !== undefined) {
      if (dto.status !== 'draft' && dto.status !== 'published') {
        throw new BadRequestException(`"${dto.status}" is not a meeting status`);
      }
      data.status = dto.status;
    }

    const row = await this.prisma.meeting.update({ where: { id: meetingId }, data });
    return toMeetingWire(row);
  }

  private async load(meetingId: string) {
    const row = await this.prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!row) throw new NotFoundException(`No meeting with id "${meetingId}"`);
    return row;
  }
}
