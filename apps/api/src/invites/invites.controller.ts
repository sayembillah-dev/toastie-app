import { BadRequestException, Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';

import { CurrentContext, type RequestContext, Requires } from '@/access';

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

  /** No `@Requires` — the caller isn't a member of the target club yet, so
   * no grant could ever match. Same reasoning as the requester-side routes
   * on `JoinRequestsController`: ownership/validity is enforced in the
   * service, not the permission engine. */
  @Post(':token/accept')
  accept(
    @CurrentContext() ctx: RequestContext,
    @Param('token') token: string,
  ): Promise<{ clubId: string; clubName: string }> {
    return this.invites.acceptByToken(ctx.session.user.id, token);
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
