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

import { CurrentContext, Public, type RequestContext, Requires } from '@/access';

import { ClubsService } from './clubs.service';
import { CreateOrgClubDto, UpdateOrgClubDto } from './dto/clubs.dto';
import { type OrgClubWire, type PublicClubWire } from './serializers';

/** Two controllers, two URL trees:
 *   - `/clubs/directory` (public)  — anyone browsing for a club to join
 *   - `/org-clubs/*`     (authed)  — CRUD for the directory-management UI
 *
 * Keeping them separate avoids the `@Public()` wart-per-route pattern and
 * makes the public projection's minimal shape a compile-time property. */

@Controller('clubs')
export class PublicClubsController {
  constructor(private readonly clubs: ClubsService) {}

  /** The link is not the credential here — it's public advertising for a
   * club, so a suspended or low-membership club is excluded. `@Public()`
   * bypasses all three global guards, so no auth header is required. */
  @Public()
  @Get('directory')
  directory(): Promise<PublicClubWire[]> {
    return this.clubs.directory();
  }
}

@Controller('org-clubs')
export class OrgClubsController {
  constructor(private readonly clubs: ClubsService) {}

  @Requires('club', 'read')
  @Get()
  list(
    @CurrentContext() ctx: RequestContext,
    @Query('areaId') areaId?: string,
  ): Promise<OrgClubWire[]> {
    return this.clubs.list(ctx.subject, areaId);
  }

  @Requires('club', 'create')
  @Post()
  create(
    @CurrentContext() ctx: RequestContext,
    @Body() dto: CreateOrgClubDto,
  ): Promise<OrgClubWire> {
    return this.clubs.create(ctx.subject, dto);
  }

  @Requires('club', 'update')
  @Patch(':clubId')
  update(
    @CurrentContext() ctx: RequestContext,
    @Param('clubId') clubId: string,
    @Body() dto: UpdateOrgClubDto,
  ): Promise<OrgClubWire> {
    return this.clubs.update(ctx.subject, clubId, dto);
  }

  @Requires('club', 'delete')
  @Delete(':clubId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @CurrentContext() ctx: RequestContext,
    @Param('clubId') clubId: string,
  ): Promise<void> {
    await this.clubs.delete(ctx.subject, clubId);
  }
}
