import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { can, type PermissionSubject } from '@toastly/access';

import { ActivityService } from '@/activity';
import { PrismaService } from '@/prisma';

import type {
  CreateTableTopicQuestionDto,
  UpdateTableTopicQuestionDto,
} from './dto/table-topics.dto';
import { type TableTopicQuestionWire, toTableTopicQuestionWire } from './serializers';

/** Handles `/meetings/:meetingId/table-topics` — the Table Topics Master's
 * question bank for a meeting. Ordered by creation, same as `ChecklistItem`. */
@Injectable()
export class TableTopicsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
  ) {}

  async list(subject: PermissionSubject, meetingId: string): Promise<TableTopicQuestionWire[]> {
    const meeting = await this.requireMeeting(meetingId);
    this.assert(subject, meeting.clubId, 'read');
    const rows = await this.prisma.tableTopicQuestion.findMany({
      where: { clubId: meeting.clubId, meetingId: meeting.id },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return rows.map(toTableTopicQuestionWire);
  }

  async create(
    subject: PermissionSubject,
    meetingId: string,
    actorMembershipId: string | null,
    dto: CreateTableTopicQuestionDto,
  ): Promise<TableTopicQuestionWire> {
    const meeting = await this.requireMeeting(meetingId);
    this.assert(subject, meeting.clubId, 'create');

    const row = await this.prisma.$transaction(async (tx) => {
      const question = await tx.tableTopicQuestion.create({
        data: {
          clubId: meeting.clubId,
          meetingId: meeting.id,
          text: dto.text.trim(),
          asked: false,
        },
      });
      await this.activity.record(
        {
          clubId: meeting.clubId,
          actorMembershipId,
          category: 'meeting',
          action: 'added a table topic question',
          summary: `Added a Table Topics question for Meeting ${meeting.meetingNumber}`,
          entityType: 'tableTopicQuestion',
          entityId: question.id,
        },
        tx,
      );
      return question;
    });
    return toTableTopicQuestionWire(row);
  }

  async update(
    subject: PermissionSubject,
    meetingId: string,
    questionId: string,
    actorMembershipId: string | null,
    dto: UpdateTableTopicQuestionDto,
  ): Promise<TableTopicQuestionWire> {
    const meeting = await this.requireMeeting(meetingId);
    this.assert(subject, meeting.clubId, 'update');
    const existing = await this.prisma.tableTopicQuestion.findUnique({ where: { id: questionId } });
    if (!existing || existing.meetingId !== meeting.id) {
      throw new NotFoundException(`No table topic question with id "${questionId}"`);
    }

    const data: Prisma.TableTopicQuestionUpdateInput = { updatedAt: new Date() };
    if (dto.text !== undefined) data.text = dto.text.trim();
    if (dto.asked !== undefined) data.asked = dto.asked;

    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.tableTopicQuestion.update({ where: { id: questionId }, data });
      if (dto.asked !== undefined && dto.asked !== existing.asked) {
        await this.activity.record(
          {
            clubId: meeting.clubId,
            actorMembershipId,
            category: 'meeting',
            action: dto.asked ? 'marked a table topic asked' : 'unmarked a table topic',
            summary: `${dto.asked ? 'Marked asked' : 'Unmarked'} a Table Topics question for Meeting ${meeting.meetingNumber}`,
            entityType: 'tableTopicQuestion',
            entityId: updated.id,
          },
          tx,
        );
      }
      return updated;
    });
    return toTableTopicQuestionWire(row);
  }

  async delete(
    subject: PermissionSubject,
    meetingId: string,
    questionId: string,
    actorMembershipId: string | null,
  ): Promise<null> {
    const meeting = await this.requireMeeting(meetingId);
    this.assert(subject, meeting.clubId, 'delete');
    const existing = await this.prisma.tableTopicQuestion.findUnique({ where: { id: questionId } });
    if (!existing || existing.meetingId !== meeting.id) {
      throw new NotFoundException(`No table topic question with id "${questionId}"`);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.tableTopicQuestion.delete({ where: { id: questionId } });
      await this.activity.record(
        {
          clubId: meeting.clubId,
          actorMembershipId,
          category: 'meeting',
          action: 'deleted a table topic question',
          summary: `Deleted a Table Topics question for Meeting ${meeting.meetingNumber}`,
          entityType: 'tableTopicQuestion',
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
    if (!can(subject, action, 'tableTopic', { clubId })) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'tableTopic',
        action,
        reason: 'You do not manage this club',
      });
    }
  }
}
