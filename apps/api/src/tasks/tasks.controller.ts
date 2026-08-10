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

  @Requires('task', 'update')
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

  @Requires('task', 'delete')
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

  @Requires('task', 'update')
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
