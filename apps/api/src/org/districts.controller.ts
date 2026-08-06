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
} from '@nestjs/common';

import { CurrentContext, type RequestContext, Requires } from '@/access';

import { DistrictsService } from './districts.service';
import { CreateDistrictDto, UpdateDistrictDto } from './dto/districts.dto';
import { type DistrictWire } from './serializers';

@Controller('districts')
export class DistrictsController {
  constructor(private readonly districts: DistrictsService) {}

  /** Coarse guard passes anyone with `orgUnit:read` in the current context;
   * the service then narrows the list to the caller's `scopeFilter`. */
  @Requires('orgUnit', 'read')
  @Get()
  list(@CurrentContext() ctx: RequestContext): Promise<DistrictWire[]> {
    return this.districts.list(ctx.subject);
  }

  @Requires('orgUnit', 'create')
  @Post()
  create(
    @CurrentContext() ctx: RequestContext,
    @Body() dto: CreateDistrictDto,
  ): Promise<DistrictWire> {
    return this.districts.create(ctx.subject, dto);
  }

  @Requires('orgUnit', 'update')
  @Patch(':districtId')
  update(
    @CurrentContext() ctx: RequestContext,
    @Param('districtId') districtId: string,
    @Body() dto: UpdateDistrictDto,
  ): Promise<DistrictWire> {
    return this.districts.update(ctx.subject, districtId, dto);
  }

  @Requires('orgUnit', 'delete')
  @Delete(':districtId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @CurrentContext() ctx: RequestContext,
    @Param('districtId') districtId: string,
  ): Promise<void> {
    await this.districts.delete(ctx.subject, districtId);
  }
}
