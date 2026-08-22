import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import { Public } from '@/access';

import { SubmitGuestInviteDto } from './dto/guest-invite.dto';
import { PeopleService } from './people.service';

/** Public counterpart to the invite-link routes on `GuestsController` — what
 * `/guest-invite/:token`, the unauthenticated self-signup page, reads and
 * posts. `@Public()` skips `JwtAuthGuard`/`ContextGuard`, same as
 * `PublicInvitesController`; the link token itself is the credential, so
 * validity is enforced by token lookup in the service, not the permission
 * engine. */
@Public()
@Controller('public/guest-invites')
export class PublicGuestInvitesController {
  constructor(private readonly people: PeopleService) {}

  @Get(':token')
  preview(@Param('token') token: string): Promise<{ clubName: string }> {
    return this.people.previewGuestInvite(token);
  }

  @Post(':token')
  submit(
    @Param('token') token: string,
    @Body() dto: SubmitGuestInviteDto,
  ): Promise<{ id: string }> {
    return this.people.submitGuestInvite(token, dto);
  }
}
