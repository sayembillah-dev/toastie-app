import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';

import { CurrentContext, type RequestContext, Requires } from '@/access';

import {
  BulkDeleteUsersDto,
  CreateUserDto,
  ListUsersQueryDto,
  SetUserAdminDto,
  SetUserPasswordDto,
  SetUserStatusDto,
  UpdateUserDto,
} from './dto/users.dto';
import { type CreateUserResultWire, type UsersPageWire, type UserWire } from './serializers';
import { UsersService } from './users.service';

/** Cross-tenant User management. Only reachable via the Super Admin
 * bypass — no club/org grants `user:*`. Every route is `@Requires('user',
 * …)` so the guard rejects a non-SA before the service ever runs. */
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Requires('user', 'read')
  @Get()
  list(
    @CurrentContext() ctx: RequestContext,
    @Query() query: ListUsersQueryDto,
  ): Promise<UsersPageWire> {
    return this.users.list(ctx.subject, {
      search: query.search,
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  /** Direct-provision: creates the account and (optionally) claims a
   * Membership in one step — the SA hands the phone + password to the
   * person out of band, there's no accept-invite round trip. */
  @Requires('user', 'create')
  @Post()
  create(
    @CurrentContext() ctx: RequestContext,
    @Body() dto: CreateUserDto,
  ): Promise<CreateUserResultWire> {
    return this.users.create(ctx.subject, dto);
  }

  /** Profile-field edit from the Super Admin's user detail panel. */
  @Requires('user', 'update')
  @Patch(':userId')
  update(
    @CurrentContext() ctx: RequestContext,
    @Param('userId') userId: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserWire> {
    return this.users.update(ctx.subject, userId, dto);
  }

  /** Admin-driven password reset. Returns nothing sensitive — the caller's
   * own form already holds the plaintext it just sent. */
  @Requires('user', 'update')
  @Post(':userId/password')
  setPassword(
    @CurrentContext() ctx: RequestContext,
    @Param('userId') userId: string,
    @Body() dto: SetUserPasswordDto,
  ): Promise<void> {
    return this.users.setPassword(ctx.subject, userId, dto);
  }

  @Requires('user', 'update')
  @Patch(':userId/status')
  setStatus(
    @CurrentContext() ctx: RequestContext,
    @Param('userId') userId: string,
    @Body() dto: SetUserStatusDto,
  ): Promise<UserWire> {
    return this.users.setStatus(ctx.subject, ctx.session.user.id, userId, dto.status);
  }

  @Requires('user', 'update')
  @Patch(':userId/admin')
  setAdmin(
    @CurrentContext() ctx: RequestContext,
    @Param('userId') userId: string,
    @Body() dto: SetUserAdminDto,
  ): Promise<UserWire> {
    return this.users.setAdmin(ctx.subject, ctx.session.user.id, userId, dto.isSuperAdmin);
  }

  /** Permanent, irreversible delete — no soft-delete, no undo. */
  @Requires('user', 'delete')
  @Delete()
  bulkDelete(
    @CurrentContext() ctx: RequestContext,
    @Body() dto: BulkDeleteUsersDto,
  ): Promise<{ deletedCount: number }> {
    return this.users.bulkDelete(ctx.subject, ctx.session.user.id, dto.userIds);
  }
}
