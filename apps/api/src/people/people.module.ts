import { Module } from '@nestjs/common';

import { InvitesModule } from '@/invites';
import { MembershipsModule } from '@/memberships';

import { GuestsController } from './people.controller';
import { PeopleService } from './people.service';
import { PublicGuestInvitesController } from './public-guest-invites.controller';

@Module({
  imports: [MembershipsModule, InvitesModule],
  controllers: [GuestsController, PublicGuestInvitesController],
  providers: [PeopleService],
  exports: [PeopleService],
})
export class PeopleModule {}
