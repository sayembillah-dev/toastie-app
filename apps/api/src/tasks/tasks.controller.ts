import { Body, Controller, Get, Param, Patch } from '@nestjs/common';

import { actorMembershipIdFor, CurrentContext, type RequestContext, Requires } from '@/access';

import { UpdateTaskDto } from './dto/tasks.dto';
import { type TaskWire } from './serializers';
import { TasksService } from './tasks.service';

@Controller()
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Requires('task', 'read')
  @Get('members/:memberId/tasks')
  listForMember(
    @CurrentContext() ctx: RequestContext,
    @Param('memberId') memberId: string,
  ): Promise<TaskWire[]> {
    return this.tasks.listForMember(ctx.subject, memberId);
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
}
