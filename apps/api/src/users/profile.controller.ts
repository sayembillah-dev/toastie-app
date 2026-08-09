import { Body, Controller, Get, Patch } from '@nestjs/common';

import { type AuthenticatedUser, CurrentUser } from '@/auth';

import { UpdateProfileDto } from './dto/profile.dto';
import { type ProfileWire } from './serializers';
import { UsersService } from './users.service';

/** Self-service profile — the signed-in account holder editing their own
 * name/email/phone/bio/avatar/socials, plus a read-only pathway summary.
 * A separate top-level path (not `/users/:userId`) so it never competes
 * with `UsersController`'s Super-Admin-only param routes, and no
 * `@Requires(...)` — any signed-in user may act on their own row, same as
 * `AuthController.session`/`changePassword`. */
@Controller('profile')
export class ProfileController {
  constructor(private readonly users: UsersService) {}

  @Get()
  getMine(@CurrentUser() user: AuthenticatedUser): Promise<ProfileWire> {
    return this.users.getProfile(user.id);
  }

  @Patch()
  updateMine(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<ProfileWire> {
    return this.users.updateProfile(user.id, dto);
  }
}
