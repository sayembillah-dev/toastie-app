import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { can, type PermissionSubject } from '@toastly/access';

import { syncMeetingFromPlannerRow } from '@/meetings/planner-mirror';
import { PrismaService } from '@/prisma';

import type { UpdatePlannerRowDto } from './dto/planner-rows.dto';
import { type PlannerRowWire, toPlannerRowWire } from './serializers';

/** Handles `/planner-rows` — the Education › Planner grid's rows. Gated by
 * the `education` resource, same as Members/Pathways, rather than a
 * dedicated resource key. */
@Injectable()
export class PlannerRowsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(subject: PermissionSubject, clubId: string): Promise<PlannerRowWire[]> {
    this.assert(subject, clubId, 'read');
    const rows = await this.prisma.plannerRow.findMany({
      where: { clubId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return rows.map(toPlannerRowWire);
  }

  async create(subject: PermissionSubject, clubId: string): Promise<PlannerRowWire> {
    this.assert(subject, clubId, 'create');
    const row = await this.prisma.plannerRow.create({ data: { clubId } });
    return toPlannerRowWire(row);
  }

  async update(
    subject: PermissionSubject,
    rowId: string,
    dto: UpdatePlannerRowDto,
  ): Promise<PlannerRowWire> {
    const existing = await this.prisma.plannerRow.findUnique({ where: { id: rowId } });
    if (!existing) throw new NotFoundException(`No planner row with id "${rowId}"`);
    this.assert(subject, existing.clubId, 'update');

    if (dto.meetingId) {
      const meeting = await this.prisma.meeting.findUnique({
        where: { id: dto.meetingId },
        select: { clubId: true },
      });
      if (!meeting || meeting.clubId !== existing.clubId) {
        throw new NotFoundException(`No meeting with id "${dto.meetingId}" in this club`);
      }
    }

    /* Unchecked input — `meetingId` is a plain FK write here, not a nested
     * `{ connect }`/`{ disconnect }` relation op. */
    const data: Prisma.PlannerRowUncheckedUpdateInput = { updatedAt: new Date() };
    if (dto.meetingNumber !== undefined) data.meetingNumber = dto.meetingNumber;
    if (dto.dateTime !== undefined) data.dateTime = dto.dateTime;
    if (dto.theme !== undefined) data.theme = dto.theme;
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.assignees !== undefined) data.assignees = dto.assignees as Prisma.InputJsonValue;
    if (dto.meetingId !== undefined) data.meetingId = dto.meetingId;

    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.plannerRow.update({ where: { id: rowId }, data });
      /* Only carry across what this call actually changed — number/date/theme
       * are scalar overwrites, so touching one that wasn't sent would clobber
       * an edit made from the meeting side moments earlier. `assignees`
       * always mirrors in full: the client sends the whole 13-slot blob on
       * every write, so it's always the authoritative current state, not a
       * partial patch. */
      if (updated.meetingId) {
        await syncMeetingFromPlannerRow(tx, existing.clubId, {
          meetingId: updated.meetingId,
          meetingNumber: dto.meetingNumber !== undefined ? updated.meetingNumber : null,
          dateTime: dto.dateTime !== undefined ? updated.dateTime : null,
          theme: dto.theme !== undefined ? updated.theme : undefined,
          assignees: updated.assignees,
        });
      }
      return updated;
    });
    return toPlannerRowWire(row);
  }

  async delete(subject: PermissionSubject, rowId: string): Promise<null> {
    const existing = await this.prisma.plannerRow.findUnique({ where: { id: rowId } });
    if (!existing) throw new NotFoundException(`No planner row with id "${rowId}"`);
    this.assert(subject, existing.clubId, 'delete');

    await this.prisma.plannerRow.delete({ where: { id: rowId } });
    return null;
  }

  private assert(
    subject: PermissionSubject,
    clubId: string,
    action: 'read' | 'create' | 'update' | 'delete',
  ): void {
    if (!can(subject, action, 'education', { clubId })) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'education',
        action,
        reason: 'You do not manage this club',
      });
    }
  }
}
