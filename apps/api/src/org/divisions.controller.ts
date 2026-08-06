import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { CurrentContext, type RequestContext, Requires } from '@/access';

import { DivisionsService } from './divisions.service';
import { CreateDivisionDto, UpdateDivisionDto } from './dto/divisions.dto';
import { type DivisionWire } from './serializers';

@Controller('divisions')
export class DivisionsController {
  constructor(private readonly divisions: DivisionsService) {}

  @Requires('orgUnit', 'read')
  @Get()
  list(
    @CurrentContext() ctx: RequestContext,
    @Query('districtId') districtId?: string,
  ): Promise<DivisionWire[]> {
    return this.divisions.list(ctx.subject, districtId);
  }

  @Requires('orgUnit', 'create')
  @Post()
  create(
    @CurrentContext() ctx: RequestContext,
    @Body() dto: CreateDivisionDto,
  ): Promise<DivisionWire> {
    return this.divisions.create(ctx.subject, dto);
  }

  @Requires('orgUnit', 'update')
  @Patch(':divisionId')
  update(
    @CurrentContext() ctx: RequestContext,
    @Param('divisionId') divisionId: string,
    @Body() dto: UpdateDivisionDto,
  ): Promise<DivisionWire> {
    return this.divisions.update(ctx.subject, divisionId, dto);
  }

  @Requires('orgUnit', 'delete')
  @Delete(':divisionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @CurrentContext() ctx: RequestContext,
    @Param('divisionId') divisionId: string,
  ): Promise<void> {
    await this.divisions.delete(ctx.subject, divisionId);
  }
}
