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

import { CurrentContext, type RequestContext, Requires } from '@/access';

import { UpdatePlannerRowDto } from './dto/planner-rows.dto';
import { PlannerRowsService } from './planner-rows.service';
import { type PlannerRowWire } from './serializers';

@Controller('planner-rows')
export class PlannerRowsController {
  constructor(private readonly plannerRows: PlannerRowsService) {}

  @Requires('education', 'read')
  @Get()
  list(@CurrentContext() ctx: RequestContext): Promise<PlannerRowWire[]> {
    return this.plannerRows.list(ctx.subject, requireClubContext(ctx));
  }

  @Requires('education', 'create')
  @Post()
  create(@CurrentContext() ctx: RequestContext): Promise<PlannerRowWire> {
    return this.plannerRows.create(ctx.subject, requireClubContext(ctx));
  }

  @Requires('education', 'update')
  @Patch(':rowId')
  update(
    @CurrentContext() ctx: RequestContext,
    @Param('rowId') rowId: string,
    @Body() dto: UpdatePlannerRowDto,
  ): Promise<PlannerRowWire> {
    return this.plannerRows.update(ctx.subject, rowId, dto);
  }

  @Requires('education', 'delete')
  @Delete(':rowId')
  delete(@CurrentContext() ctx: RequestContext, @Param('rowId') rowId: string): Promise<null> {
    return this.plannerRows.delete(ctx.subject, rowId);
  }
}

function requireClubContext(ctx: RequestContext): string {
  if (!ctx.clubId) {
    throw new BadRequestException({
      code: 'CLUB_CONTEXT_REQUIRED',
      message: 'Planner rows are only accessible from a club context',
    });
  }
  return ctx.clubId;
}
