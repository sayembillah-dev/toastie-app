import { BadRequestException, Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';

import { CurrentContext, type RequestContext, Requires } from '@/access';
import { type MemberWire } from '@/memberships';

import { CreateInviteDto } from './dto/invites.dto';
import { InvitesService } from './invites.service';
import { type InviteWire } from './serializers';

@Controller('invites')
export class InvitesController {
  constructor(private readonly invites: InvitesService) {}

  @Requires('invite', 'read')
  @Get()
  list(@CurrentContext() ctx: RequestContext): Promise<InviteWire[]> {
    const clubId = requireClubContext(ctx);
    return this.invites.list(ctx.subject, clubId);
  }

  @Requires('invite', 'create')
  @Post()
  create(@CurrentContext() ctx: RequestContext, @Body() dto: CreateInviteDto): Promise<InviteWire> {
    const clubId = requireClubContext(ctx);
    return this.invites.create(ctx.subject, clubId, ctx.session.user.id, dto);
  }

  @Requires('invite', 'delete')
  @Delete(':inviteId')
  revoke(
    @CurrentContext() ctx: RequestContext,
    @Param('inviteId') inviteId: string,
  ): Promise<InviteWire> {
    return this.invites.revoke(ctx.subject, inviteId);
  }

  /** `invite:update` matches the resource metadata the web already carries
   * on this route (`handlers.ts:3185`). The response is the freshly-created
   * `Member` — the frontend's `convertInviteToMember` mutation writes
   * straight into the members cache. */
  @Requires('invite', 'update')
  @Post(':inviteId/convert')
  convertToMember(
    @CurrentContext() ctx: RequestContext,
    @Param('inviteId') inviteId: string,
  ): Promise<MemberWire> {
    return this.invites.convertToMember(ctx.subject, inviteId);
  }
}

function requireClubContext(ctx: RequestContext): string {
  if (!ctx.clubId) {
    throw new BadRequestException({
      code: 'CLUB_CONTEXT_REQUIRED',
      message: 'Invites are only accessible from a club context',
    });
  }
  return ctx.clubId;
}
