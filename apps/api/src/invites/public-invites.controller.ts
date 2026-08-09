import { Controller, Get, Param } from '@nestjs/common';

import { Public } from '@/access';

import { InvitesService } from './invites.service';
import { type InvitePreview } from './serializers';

/** Public counterpart to `InvitesController` — what `/invite/:token`, the
 * unauthenticated landing page, reads before asking the visitor to log in
 * or sign up. `@Public()` skips `JwtAuthGuard`/`ContextGuard`, same as
 * `PublicUsersController`/`PublicMeetingsController`. */
@Public()
@Controller('public/invites')
export class PublicInvitesController {
  constructor(private readonly invites: InvitesService) {}

  @Get(':token')
  preview(@Param('token') token: string): Promise<InvitePreview> {
    return this.invites.previewByToken(token);
  }
}
