import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { CurrentContext, type RequestContext, Requires } from '@/access';

import {
  BulkCreateMembersDto,
  CreateMemberDto,
  SetMemberAdminDto,
  SetMemberStatusDto,
  UpdateMemberDto,
} from './dto/members.dto';
import { type BulkCreateResult, MembershipsService } from './memberships.service';
import { type MemberWire } from './serializers';

/** URL kept as `/members` even though the DB model is `Membership` — the
 * frontend has hundreds of call sites written against `member`. The
 * @toastly/access resource keys still use `member`, so nothing else changes. */
@Controller('members')
export class MembershipsController {
  constructor(private readonly memberships: MembershipsService) {}

  /** Coarse `member:read` in the current context; the service asserts the
   * fine `can()` against the resolved `ctx.clubId`. A non-club context
   * (director-scoped, global) has no roster to list here — the director
   * drill-in gets its own URL in S13. */
  @Requires('member', 'read')
  @Get()
  list(
    @CurrentContext() ctx: RequestContext,
    @Query('includeRemoved') includeRemoved?: string,
  ): Promise<MemberWire[]> {
    const clubId = requireClubContext(ctx);
    return this.memberships.list(ctx.subject, clubId, includeRemoved === 'true');
  }

  @Requires('member', 'read')
  @Get(':memberId')
  get(
    @CurrentContext() ctx: RequestContext,
    @Param('memberId') memberId: string,
  ): Promise<MemberWire> {
    return this.memberships.get(ctx.subject, memberId);
  }

  @Requires('member', 'create')
  @Post()
  create(@CurrentContext() ctx: RequestContext, @Body() dto: CreateMemberDto): Promise<MemberWire> {
    const clubId = requireClubContext(ctx);
    return this.memberships.create(ctx.subject, clubId, dto);
  }

  /** Best-effort bulk add — each row is an independent `create()`; conflicts
   * come back in `failed` rather than failing the whole submission. */
  @Requires('member', 'create')
  @Post('bulk')
  bulkCreate(
    @CurrentContext() ctx: RequestContext,
    @Body() dto: BulkCreateMembersDto,
  ): Promise<BulkCreateResult> {
    const clubId = requireClubContext(ctx);
    return this.memberships.bulkCreate(ctx.subject, clubId, dto);
  }

  @Requires('member', 'update')
  @Patch(':memberId')
  update(
    @CurrentContext() ctx: RequestContext,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateMemberDto,
  ): Promise<MemberWire> {
    return this.memberships.update(ctx.subject, memberId, dto);
  }

  @Requires('member', 'update')
  @Post(':memberId/status')
  setStatus(
    @CurrentContext() ctx: RequestContext,
    @Param('memberId') memberId: string,
    @Body() dto: SetMemberStatusDto,
  ): Promise<MemberWire> {
    return this.memberships.setStatus(ctx.subject, memberId, dto);
  }

  @Requires('memberRole', 'update')
  @Post(':memberId/admin')
  setAdmin(
    @CurrentContext() ctx: RequestContext,
    @Param('memberId') memberId: string,
    @Body() dto: SetMemberAdminDto,
  ): Promise<MemberWire> {
    return this.memberships.setAdmin(ctx.subject, memberId, dto);
  }

  @Requires('memberPermission', 'update')
  @Patch(':memberId/permissions')
  setPermissions(
    @CurrentContext() ctx: RequestContext,
    @Param('memberId') memberId: string,
    @Body() body: Record<string, 'allow' | 'deny' | 'default'>,
  ): Promise<MemberWire> {
    return this.memberships.setPermissions(ctx.subject, memberId, body);
  }
}

/** Every `/members` mutation is inherently club-scoped — the wire model
 * has a `clubId` on every row and the web only opens the roster from a
 * club context. Reject any other context here rather than at every
 * service method. */
function requireClubContext(ctx: RequestContext): string {
  if (!ctx.clubId) {
    throw new BadRequestException({
      code: 'CLUB_CONTEXT_REQUIRED',
      message: 'Members are only accessible from a club context',
    });
  }
  return ctx.clubId;
}
