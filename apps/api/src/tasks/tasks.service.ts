import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { can, type PermissionSubject } from '@toastly/access';

import { ActivityService } from '@/activity';
import { PrismaService } from '@/prisma';

import type { UpdateTaskDto } from './dto/tasks.dto';
import { type TaskWire, toTaskWire } from './serializers';

/** Handles `/members/:memberId/tasks` (list) and `/tasks/:taskId` (patch).
 * Task rows carry an owner (`membershipId`); the fine `can()` check uses
 * both the row's clubId (coarse `task:*@club`) and its owner (for `own`
 * scope, so a member can complete their own tasks even without the wider
 * grant). */
@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
  ) {}

  async listForMember(subject: PermissionSubject, memberId: string): Promise<TaskWire[]> {
    const member = await this.prisma.membership.findUnique({
      where: { id: memberId },
      select: { id: true, clubId: true },
    });
    if (!member) throw new NotFoundException(`No member with id "${memberId}"`);
    if (!can(subject, 'read', 'task', { clubId: member.clubId, ownerMembershipId: member.id })) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'task',
        action: 'read',
        reason: 'You do not manage this club',
      });
    }
    const rows = await this.prisma.task.findMany({
      where: { clubId: member.clubId, membershipId: member.id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return rows.map(toTaskWire);
  }

  async updateTask(
    subject: PermissionSubject,
    taskId: string,
    actorMembershipId: string | null,
    dto: UpdateTaskDto,
  ): Promise<TaskWire> {
    const existing = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!existing) throw new NotFoundException(`No task with id "${taskId}"`);
    if (
      !can(subject, 'update', 'task', {
        clubId: existing.clubId,
        ownerMembershipId: existing.membershipId,
      })
    ) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'task',
        action: 'update',
        reason: 'You do not manage this task',
      });
    }

    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.task.update({
        where: { id: taskId },
        data: { done: dto.done, updatedAt: new Date() },
      });
      await this.activity.record(
        {
          clubId: updated.clubId,
          actorMembershipId,
          category: 'task',
          action: updated.done ? 'completed a task' : 'reopened a task',
          summary: `${updated.done ? 'Completed' : 'Reopened'} "${updated.title}"`,
          entityType: 'task',
          entityId: updated.id,
        },
        tx,
      );
      return updated;
    });
    return toTaskWire(row);
  }
}
