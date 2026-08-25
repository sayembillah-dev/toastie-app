import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';

import { actorMembershipIdFor, CurrentContext, type RequestContext, Requires } from '@/access';

import { CreateTaskDto, CreateTaskNoteDto, UpdateTaskDto } from './dto/tasks.dto';
import { type TaskWire } from './serializers';
import { TasksService } from './tasks.service';

@Controller()
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Requires('task', 'read')
  @Get('tasks')
  listForClub(@CurrentContext() ctx: RequestContext): Promise<TaskWire[]> {
    const clubId = requireClubContext(ctx);
    return this.tasks.listForClub(ctx.subject, clubId);
  }

  @Requires('task', 'read')
  @Get('members/:memberId/tasks')
  listForMember(
    @CurrentContext() ctx: RequestContext,
    @Param('memberId') memberId: string,
  ): Promise<TaskWire[]> {
    return this.tasks.listForMember(ctx.subject, memberId);
  }

  @Requires('task', 'create')
  @Post('tasks')
  createTask(@CurrentContext() ctx: RequestContext, @Body() dto: CreateTaskDto): Promise<TaskWire> {
    const clubId = requireClubContext(ctx);
    return this.tasks.createTask(ctx.subject, clubId, actorMembershipIdFor(ctx, clubId), dto);
  }

  /* Coarse gate stays at `read` (every club member has it club-wide): an
   * assignee may close out their OWN task and the creator may edit it, but
   * ownership isn't known until the row loads — `TasksService.updateTask`
   * re-checks `task:update` with the real `ownerMembershipId` set. */
  @Requires('task', 'read')
  @Patch('tasks/:taskId')
  updateTask(
    @CurrentContext() ctx: RequestContext,
    @Param('taskId') taskId: string,
    @Body() dto: UpdateTaskDto,
  ): Promise<TaskWire> {
    const clubId = ctx.clubId;
    return this.tasks.updateTask(
      ctx.subject,
      taskId,
      clubId ? actorMembershipIdFor(ctx, clubId) : null,
      dto,
    );
  }

  /* Same two-phase shape as PATCH above: officers hold `task:delete` at
   * `own` scope (the task they created), which the pre-handler gate can't
   * see — `TasksService.deleteTask` re-checks with `createdByMembershipId`. */
  @Requires('task', 'read')
  @Delete('tasks/:taskId')
  deleteTask(
    @CurrentContext() ctx: RequestContext,
    @Param('taskId') taskId: string,
  ): Promise<null> {
    const clubId = ctx.clubId;
    return this.tasks.deleteTask(
      ctx.subject,
      taskId,
      clubId ? actorMembershipIdFor(ctx, clubId) : null,
    );
  }

  /* Notes are a comment thread any club member may post to — the service
   * checks `task:read` club-wide, so the coarse gate is `read` too (an
   * `update` gate would 403 every plain member pre-handler). */
  @Requires('task', 'read')
  @Post('tasks/:taskId/notes')
  addNote(
    @CurrentContext() ctx: RequestContext,
    @Param('taskId') taskId: string,
    @Body() dto: CreateTaskNoteDto,
  ): Promise<TaskWire> {
    const clubId = ctx.clubId;
    return this.tasks.addNote(
      ctx.subject,
      taskId,
      clubId ? actorMembershipIdFor(ctx, clubId) : null,
      dto,
    );
  }
}

function requireClubContext(ctx: RequestContext): string {
  if (!ctx.clubId) {
    throw new BadRequestException({
      code: 'CLUB_CONTEXT_REQUIRED',
      message: 'Tasks are only accessible from a club context',
    });
  }
  return ctx.clubId;
}
