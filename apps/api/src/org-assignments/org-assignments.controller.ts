import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';

import { CurrentContext, type RequestContext, Requires } from '@/access';

import { CreateOrgAssignmentDto } from './dto/org-assignments.dto';
import { OrgAssignmentsService } from './org-assignments.service';
import { type OrgAssignmentWire } from './serializers';

@Controller('users/:userId/org-assignments')
export class OrgAssignmentsController {
  constructor(private readonly orgAssignments: OrgAssignmentsService) {}

  @Requires('orgAssignment', 'read')
  @Get()
  list(
    @CurrentContext() ctx: RequestContext,
    @Param('userId') userId: string,
  ): Promise<OrgAssignmentWire[]> {
    return this.orgAssignments.listForUser(ctx.subject, userId);
  }

  @Requires('orgAssignment', 'create')
  @Post()
  create(
    @CurrentContext() ctx: RequestContext,
    @Param('userId') userId: string,
    @Body() dto: CreateOrgAssignmentDto,
  ): Promise<OrgAssignmentWire> {
    return this.orgAssignments.create(ctx.subject, userId, dto);
  }

  @Requires('orgAssignment', 'delete')
  @Delete(':assignmentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @CurrentContext() ctx: RequestContext,
    @Param('userId') userId: string,
    @Param('assignmentId') assignmentId: string,
  ): Promise<void> {
    await this.orgAssignments.delete(ctx.subject, userId, assignmentId);
  }
}
