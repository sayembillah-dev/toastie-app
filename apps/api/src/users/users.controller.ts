import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';

import { CurrentContext, type RequestContext, Requires } from '@/access';

import { ListUsersQueryDto, SetUserAdminDto, SetUserStatusDto } from './dto/users.dto';
import { type UsersPageWire, type UserWire } from './serializers';
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
    });
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
}
