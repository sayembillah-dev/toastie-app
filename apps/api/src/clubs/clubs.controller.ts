import {
  BadRequestException,
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
import { CreateOrgClubDto, JoinByCodeDto, UpdateOrgClubDto } from './dto/clubs.dto';
import { type OrgClubWire, type PublicClubWire } from './serializers';

/** Two controllers, two URL trees:
 *   - `/clubs/*`     — anyone browsing for a club (`directory`, public) and
 *     a signed-in-but-clubless user joining one (`join-by-code`), plus the
 *     Club Admin's own `join-code` readback. Not all-public despite the
 *     class name; only `directory` carries `@Public()`.
 *   - `/org-clubs/*` (authed) — CRUD for the directory-management UI
 *
 * Keeping the public/self-service tree separate from `/org-clubs` avoids the
 * `@Public()` wart-per-route pattern there and makes the public projection's
 * minimal shape a compile-time property. */

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

  /** Club Admin's own dashboard reads its club's standing join code here to
   * display + copy it. Gated by `club:update` (same grant that lets a Club
   * Admin rename their club) rather than a bespoke permission. */
  @Requires('club', 'update')
  @Get('join-code')
  getJoinCode(@CurrentContext() ctx: RequestContext): Promise<{ code: string }> {
    return this.clubs.getJoinCode(requireClubContext(ctx));
  }

  /** No `@Requires` — the caller isn't a member of the target club yet, so
   * no grant could ever match. Same reasoning as `InvitesController#accept`
   * and the requester-side routes on `JoinRequestsController`: validity is
   * enforced in the service, not the permission engine. */
  @Post('join-by-code')
  joinByCode(
    @CurrentContext() ctx: RequestContext,
    @Body() dto: JoinByCodeDto,
  ): Promise<{ clubId: string; clubName: string }> {
    return this.clubs.joinByCode(ctx.session.user.id, dto.code);
  }
}

function requireClubContext(ctx: RequestContext): string {
  if (!ctx.clubId) {
    throw new BadRequestException({
      code: 'CLUB_CONTEXT_REQUIRED',
      message: 'The club join code is only accessible from a club context',
    });
  }
  return ctx.clubId;
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
