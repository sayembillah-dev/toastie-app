import { BadRequestException, Body, Controller, Get, Param, Post, Query } from '@nestjs/common';

import { CurrentContext, type RequestContext, Requires } from '@/access';
import { type MemberWire } from '@/memberships';

import { CreateJoinRequestDto } from './dto/join-requests.dto';
import { JoinRequestsService } from './join-requests.service';
import { type JoinRequestWire } from './serializers';

const STATUS_VALUES = ['pending', 'approved', 'declined', 'withdrawn'] as const;
type StatusFilter = (typeof STATUS_VALUES)[number];

/** Two audiences, one URL tree:
 *
 *   POST /join-requests               — the requester (any authed user)
 *   POST /join-requests/:id/withdraw  — the requester only
 *   GET  /join-requests/mine          — the requester's own history
 *   GET  /join-requests               — the club's admins
 *   POST /join-requests/:id/approve   — the club's admins
 *   POST /join-requests/:id/decline   — the club's admins
 *
 * `@Requires` is set only on the admin routes; the requester routes are
 * authed-but-not-permission-gated (no context or role would grant a plain
 * user permission over an unowned club, so gating this via @Requires would
 * make it a 403 for every legitimate call). Ownership is enforced in the
 * service. */
@Controller('join-requests')
export class JoinRequestsController {
  constructor(private readonly joinRequests: JoinRequestsService) {}

  @Post()
  create(
    @CurrentContext() ctx: RequestContext,
    @Body() dto: CreateJoinRequestDto,
  ): Promise<JoinRequestWire> {
    return this.joinRequests.createFromUser(ctx.session.user.id, dto);
  }

  @Get('mine')
  listMine(@CurrentContext() ctx: RequestContext): Promise<JoinRequestWire[]> {
    return this.joinRequests.listForUser(ctx.session.user.id);
  }

  @Post(':requestId/withdraw')
  withdraw(
    @CurrentContext() ctx: RequestContext,
    @Param('requestId') requestId: string,
  ): Promise<JoinRequestWire> {
    return this.joinRequests.withdraw(ctx.session.user.id, requestId);
  }

  @Requires('joinRequest', 'read')
  @Get()
  list(
    @CurrentContext() ctx: RequestContext,
    @Query('status') status?: string,
  ): Promise<JoinRequestWire[]> {
    const clubId = requireClubContext(ctx);
    return this.joinRequests.listForClub(ctx.subject, clubId, parseStatus(status));
  }

  @Requires('joinRequest', 'update')
  @Post(':requestId/approve')
  approve(
    @CurrentContext() ctx: RequestContext,
    @Param('requestId') requestId: string,
  ): Promise<MemberWire> {
    return this.joinRequests.approve(ctx.subject, requestId);
  }

  @Requires('joinRequest', 'update')
  @Post(':requestId/decline')
  decline(
    @CurrentContext() ctx: RequestContext,
    @Param('requestId') requestId: string,
  ): Promise<JoinRequestWire> {
    return this.joinRequests.decline(ctx.subject, requestId);
  }
}

function requireClubContext(ctx: RequestContext): string {
  if (!ctx.clubId) {
    throw new BadRequestException({
      code: 'CLUB_CONTEXT_REQUIRED',
      message: 'Join requests are only accessible from a club context',
    });
  }
  return ctx.clubId;
}

function parseStatus(raw: string | undefined): StatusFilter | undefined {
  if (!raw) return undefined;
  if ((STATUS_VALUES as readonly string[]).includes(raw)) return raw as StatusFilter;
  throw new BadRequestException(`Unknown join-request status "${raw}"`);
}
