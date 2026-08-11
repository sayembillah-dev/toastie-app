import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { can, type PermissionSubject } from '@toastly/access';

import { ActivityService } from '@/activity';
import { PrismaService } from '@/prisma';
import { PushService } from '@/push';

import type { CreateTaskDto, CreateTaskNoteDto, UpdateTaskDto } from './dto/tasks.dto';
import { type TaskRow, type TaskWire, taskInclude, toTaskWire } from './serializers';

/** Handles the whole `/tasks` surface plus the legacy `/members/:memberId/tasks`
 * read the "Me" widget uses. Every write re-checks `can()` with the row's
 * real `clubId` and the relevant owner (`createdByMembershipId` for
 * structural edits/delete, the caller's own membership for closing out a
 * task they're assigned to) — the `@Requires()` decorator on the controller
 * is only the coarse pre-handler gate. */
@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly push: PushService,
  ) {}

  async listForClub(subject: PermissionSubject, clubId: string): Promise<TaskWire[]> {
    if (!can(subject, 'read', 'task', { clubId })) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'task',
        action: 'read',
        reason: 'You do not manage this club',
      });
    }
    const rows = await this.prisma.task.findMany({
      where: { clubId },
      include: taskInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return rows.map(toTaskWire);
  }

  /** Kept for the "Me" dashboard/profile widget — tasks assigned to one
   * member, via the `TaskAssignee` pivot rather than the old single
   * `membershipId` column. */
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
      where: { clubId: member.clubId, assignees: { some: { membershipId: member.id } } },
      include: taskInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return rows.map(toTaskWire);
  }

  async createTask(
    subject: PermissionSubject,
    clubId: string,
    actorMembershipId: string | null,
    dto: CreateTaskDto,
  ): Promise<TaskWire> {
    if (!actorMembershipId) {
      throw new ForbiddenException({
        code: 'MEMBERSHIP_REQUIRED',
        message: 'Only a club member can create a task',
      });
    }
    if (!can(subject, 'create', 'task', { clubId })) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'task',
        action: 'create',
        reason: 'Only club officers can create tasks',
      });
    }

    const assigneeIds = Array.from(new Set(dto.assigneeMembershipIds));
    await this.assertAssigneesInClub(assigneeIds, clubId);

    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.task.create({
        data: {
          clubId,
          title: dto.title,
          description: dto.description,
          priority: dto.priority,
          createdByMembershipId: actorMembershipId,
          assignees: { create: assigneeIds.map((membershipId) => ({ clubId, membershipId })) },
        },
        include: taskInclude,
      });
      await this.activity.record(
        {
          clubId,
          actorMembershipId,
          category: 'task',
          action: 'created a task',
          summary: `Created "${created.title}"`,
          entityType: 'task',
          entityId: created.id,
        },
        tx,
      );
      return created;
    });

    this.notifyAssignees(row, actorMembershipId);
    return toTaskWire(row);
  }

  async updateTask(
    subject: PermissionSubject,
    taskId: string,
    actorMembershipId: string | null,
    dto: UpdateTaskDto,
  ): Promise<TaskWire> {
    const existing = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: taskInclude,
    });
    if (!existing) throw new NotFoundException(`No task with id "${taskId}"`);

    const isAssignee =
      actorMembershipId != null &&
      existing.assignees.some((a) => a.membershipId === actorMembershipId);
    const touchesStructure =
      dto.title !== undefined ||
      dto.description !== undefined ||
      dto.priority !== undefined ||
      dto.assigneeMembershipIds !== undefined;

    if (touchesStructure) {
      // Editing the task itself (not just closing it out) is the creator's
      // call, or a role with the wider club-scoped grant (VPEducation,
      // ClubAdmin) moderating it.
      if (
        !can(subject, 'update', 'task', {
          clubId: existing.clubId,
          ownerMembershipId: existing.createdByMembershipId,
        })
      ) {
        throw new ForbiddenException({
          code: 'PERMISSION_DENIED',
          resource: 'task',
          action: 'update',
          reason: 'Only the person who created this task can edit it',
        });
      }
    } else if (dto.done !== undefined) {
      // Closing it out: the assignee who's doing it, the creator, or an
      // admin/VPE — never an uninvolved member.
      const ownerTarget = isAssignee
        ? (actorMembershipId as string)
        : existing.createdByMembershipId;
      if (
        !can(subject, 'update', 'task', { clubId: existing.clubId, ownerMembershipId: ownerTarget })
      ) {
        throw new ForbiddenException({
          code: 'PERMISSION_DENIED',
          resource: 'task',
          action: 'update',
          reason: 'You are not assigned to this task',
        });
      }
    }

    let assigneeIds: string[] | undefined;
    if (dto.assigneeMembershipIds !== undefined) {
      assigneeIds = Array.from(new Set(dto.assigneeMembershipIds));
      await this.assertAssigneesInClub(assigneeIds, existing.clubId);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      if (assigneeIds !== undefined) {
        await tx.taskAssignee.deleteMany({ where: { taskId } });
        if (assigneeIds.length > 0) {
          await tx.taskAssignee.createMany({
            data: assigneeIds.map((membershipId) => ({
              taskId,
              clubId: existing.clubId,
              membershipId,
            })),
          });
        }
      }

      const justCompleted = dto.done === true && !existing.done;
      const updated = await tx.task.update({
        where: { id: taskId },
        data: {
          title: dto.title,
          description: dto.description,
          priority: dto.priority,
          done: dto.done,
          doneByMembershipId:
            dto.done === undefined ? undefined : dto.done ? actorMembershipId : null,
          doneAt: dto.done === undefined ? undefined : dto.done ? new Date() : null,
          updatedAt: new Date(),
        },
        include: taskInclude,
      });

      await this.activity.record(
        {
          clubId: updated.clubId,
          actorMembershipId,
          category: 'task',
          action:
            dto.done !== undefined
              ? dto.done
                ? 'completed a task'
                : 'reopened a task'
              : 'updated a task',
          summary:
            dto.done !== undefined
              ? `${dto.done ? 'Completed' : 'Reopened'} "${updated.title}"`
              : `Updated "${updated.title}"`,
          entityType: 'task',
          entityId: updated.id,
        },
        tx,
      );

      return { updated, justCompleted };
    });

    if (result.justCompleted) this.notifyCreatorOfCompletion(result.updated, actorMembershipId);
    return toTaskWire(result.updated);
  }

  async deleteTask(
    subject: PermissionSubject,
    taskId: string,
    actorMembershipId: string | null,
  ): Promise<null> {
    const existing = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!existing) throw new NotFoundException(`No task with id "${taskId}"`);
    if (
      !can(subject, 'delete', 'task', {
        clubId: existing.clubId,
        ownerMembershipId: existing.createdByMembershipId,
      })
    ) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'task',
        action: 'delete',
        reason: 'Only the person who created this task can delete it',
      });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.task.delete({ where: { id: taskId } });
      await this.activity.record(
        {
          clubId: existing.clubId,
          actorMembershipId,
          category: 'task',
          action: 'deleted a task',
          summary: `Deleted "${existing.title}"`,
          entityType: 'task',
          entityId: existing.id,
        },
        tx,
      );
    });
    return null;
  }

  async addNote(
    subject: PermissionSubject,
    taskId: string,
    actorMembershipId: string | null,
    dto: CreateTaskNoteDto,
  ): Promise<TaskWire> {
    const existing = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: taskInclude,
    });
    if (!existing) throw new NotFoundException(`No task with id "${taskId}"`);

    // Notes are a comment thread, not a structural edit — anyone who can see
    // this task (i.e. any club member) can add one, not just the creator or
    // an assignee.
    if (!actorMembershipId || !can(subject, 'read', 'task', { clubId: existing.clubId })) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: 'task',
        action: 'update',
        reason: 'Only a member of this club can add notes',
      });
    }

    const row = await this.prisma.$transaction(async (tx) => {
      await tx.taskNote.create({
        data: {
          taskId,
          clubId: existing.clubId,
          membershipId: actorMembershipId as string,
          body: dto.body,
        },
      });
      await this.activity.record(
        {
          clubId: existing.clubId,
          actorMembershipId,
          category: 'task',
          action: 'added a task note',
          summary: `Added a note on "${existing.title}"`,
          entityType: 'task',
          entityId: existing.id,
        },
        tx,
      );
      return tx.task.findUniqueOrThrow({ where: { id: taskId }, include: taskInclude });
    });
    return toTaskWire(row);
  }

  private async assertAssigneesInClub(membershipIds: string[], clubId: string): Promise<void> {
    if (membershipIds.length === 0) return;
    const count = await this.prisma.membership.count({
      where: { id: { in: membershipIds }, clubId },
    });
    if (count !== membershipIds.length) {
      throw new BadRequestException({
        code: 'INVALID_ASSIGNEE',
        message: 'One or more assignees are not members of this club',
      });
    }
  }

  /** Fire-and-forget — `PushService.send()` already swallows per-device
   * failures, and a notification failing shouldn't fail the create/complete
   * request that triggered it. */
  private notifyAssignees(row: TaskRow, actorMembershipId: string): void {
    const creatorName = `${row.createdBy.firstName} ${row.createdBy.lastName}`;
    for (const assignee of row.assignees) {
      if (assignee.membershipId === actorMembershipId) continue; // don't notify yourself
      const userId = assignee.membership.userId;
      if (!userId) continue; // unclaimed membership — nobody to push to yet
      void this.push.send(userId, {
        title: 'New task assigned',
        body: `${creatorName} assigned you: ${row.title}`,
        url: '/tasks',
      });
    }
  }

  private notifyCreatorOfCompletion(row: TaskRow, actorMembershipId: string | null): void {
    if (row.createdByMembershipId === actorMembershipId) return; // creator closed their own task
    const userId = row.createdBy.userId;
    if (!userId) return;
    const completerName = row.doneBy ? `${row.doneBy.firstName} ${row.doneBy.lastName}` : 'Someone';
    void this.push.send(userId, {
      title: 'Task completed',
      body: `${completerName} marked "${row.title}" as done`,
      url: '/tasks',
    });
  }
}
