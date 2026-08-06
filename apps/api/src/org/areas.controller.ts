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

import { AreasService } from './areas.service';
import { CreateAreaDto, UpdateAreaDto } from './dto/areas.dto';
import { type AreaWire } from './serializers';

@Controller('areas')
export class AreasController {
  constructor(private readonly areas: AreasService) {}

  @Requires('orgUnit', 'read')
  @Get()
  list(
    @CurrentContext() ctx: RequestContext,
    @Query('divisionId') divisionId?: string,
  ): Promise<AreaWire[]> {
    return this.areas.list(ctx.subject, divisionId);
  }

  @Requires('orgUnit', 'create')
  @Post()
  create(@CurrentContext() ctx: RequestContext, @Body() dto: CreateAreaDto): Promise<AreaWire> {
    return this.areas.create(ctx.subject, dto);
  }

  @Requires('orgUnit', 'update')
  @Patch(':areaId')
  update(
    @CurrentContext() ctx: RequestContext,
    @Param('areaId') areaId: string,
    @Body() dto: UpdateAreaDto,
  ): Promise<AreaWire> {
    return this.areas.update(ctx.subject, areaId, dto);
  }

  @Requires('orgUnit', 'delete')
  @Delete(':areaId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @CurrentContext() ctx: RequestContext,
    @Param('areaId') areaId: string,
  ): Promise<void> {
    await this.areas.delete(ctx.subject, areaId);
  }
}
