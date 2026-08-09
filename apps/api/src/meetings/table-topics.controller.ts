import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';

import { actorMembershipIdFor, CurrentContext, type RequestContext, Requires } from '@/access';

import { CreateTableTopicQuestionDto, UpdateTableTopicQuestionDto } from './dto/table-topics.dto';
import { type TableTopicQuestionWire } from './serializers';
import { TableTopicsService } from './table-topics.service';

@Controller('meetings/:meetingId/table-topics')
export class TableTopicsController {
  constructor(private readonly tableTopics: TableTopicsService) {}

  @Requires('tableTopic', 'read')
  @Get()
  list(
    @CurrentContext() ctx: RequestContext,
    @Param('meetingId') meetingId: string,
  ): Promise<TableTopicQuestionWire[]> {
    return this.tableTopics.list(ctx.subject, meetingId);
  }

  @Requires('tableTopic', 'create')
  @Post()
  create(
    @CurrentContext() ctx: RequestContext,
    @Param('meetingId') meetingId: string,
    @Body() dto: CreateTableTopicQuestionDto,
  ): Promise<TableTopicQuestionWire> {
    const clubId = ctx.clubId;
    return this.tableTopics.create(
      ctx.subject,
      meetingId,
      clubId ? actorMembershipIdFor(ctx, clubId) : null,
      dto,
    );
  }

  @Requires('tableTopic', 'update')
  @Patch(':questionId')
  update(
    @CurrentContext() ctx: RequestContext,
    @Param('meetingId') meetingId: string,
    @Param('questionId') questionId: string,
    @Body() dto: UpdateTableTopicQuestionDto,
  ): Promise<TableTopicQuestionWire> {
    const clubId = ctx.clubId;
    return this.tableTopics.update(
      ctx.subject,
      meetingId,
      questionId,
      clubId ? actorMembershipIdFor(ctx, clubId) : null,
      dto,
    );
  }

  @Requires('tableTopic', 'delete')
  @Delete(':questionId')
  delete(
    @CurrentContext() ctx: RequestContext,
    @Param('meetingId') meetingId: string,
    @Param('questionId') questionId: string,
  ): Promise<null> {
    const clubId = ctx.clubId;
    return this.tableTopics.delete(
      ctx.subject,
      meetingId,
      questionId,
      clubId ? actorMembershipIdFor(ctx, clubId) : null,
    );
  }
}
