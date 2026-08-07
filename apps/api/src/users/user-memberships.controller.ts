import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';

import { CurrentContext, type RequestContext, Requires } from '@/access';
import {
  MembershipsService,
  type MemberWire,
  type PlatformUserMembershipWire,
} from '@/memberships';

import { CreateUserMembershipDto, UpdateUserMembershipDto } from './dto/user-memberships.dto';
import { UsersService } from './users.service';

/** The Super Admin user-detail panel's "club memberships" section — an
 * existing user's memberships across every club, addressable by user id
 * rather than by the current `X-Toastly-Context`. Every route gates on the
 * `user` resource (like the rest of `UsersController`), not `member` —
 * this whole controller only exists under the SA-only `/users` prefix, and
 * gating on `member` would let a Club Admin (who legitimately holds
 * `member:create`/`update` for their own club) reach `getBasic()` below
 * and probe an arbitrary user's name/email before the fine-grained
 * `MembershipsService` check on `clubId` ever runs. Reads and edits reuse
 * `MembershipsService` directly; only creation is new here, since
 * `MembershipsService.create()` always makes an unclaimed roster row. */
@Controller('users/:userId/memberships')
export class UserMembershipsController {
  constructor(
    private readonly users: UsersService,
    private readonly memberships: MembershipsService,
  ) {}

  @Requires('user', 'read')
  @Get()
  list(@Param('userId') userId: string): Promise<PlatformUserMembershipWire[]> {
    return this.memberships.listForUser(userId);
  }

  @Requires('user', 'update')
  @Post()
  async create(
    @CurrentContext() ctx: RequestContext,
    @Param('userId') userId: string,
    @Body() dto: CreateUserMembershipDto,
  ): Promise<MemberWire> {
    const user = await this.users.getBasic(userId);
    return this.memberships.createForUser(ctx.subject, {
      userId: user.id,
      clubId: dto.clubId,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      roles: dto.roles,
      isClubAdmin: dto.isClubAdmin,
      memberType: dto.memberType,
    });
  }

  /** Applies whichever of roles/isClubAdmin/status are present, each via
   * the same `MembershipsService` method the club-scoped `/members`
   * controller uses, then re-reads so the response reflects every change
   * regardless of how many fields were sent in one save. */
  @Requires('user', 'update')
  @Patch(':membershipId')
  async update(
    @CurrentContext() ctx: RequestContext,
    @Param('membershipId') membershipId: string,
    @Body() dto: UpdateUserMembershipDto,
  ): Promise<MemberWire> {
    if (dto.roles !== undefined) {
      await this.memberships.update(ctx.subject, membershipId, { roles: dto.roles });
    }
    if (dto.isClubAdmin !== undefined) {
      await this.memberships.setAdmin(ctx.subject, membershipId, { isClubAdmin: dto.isClubAdmin });
    }
    if (dto.status !== undefined) {
      await this.memberships.setStatus(ctx.subject, membershipId, { status: dto.status });
    }
    return this.memberships.get(ctx.subject, membershipId);
  }
}
