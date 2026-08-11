import { Module } from '@nestjs/common';

import { InvitesModule } from '@/invites';
import { MembershipsModule } from '@/memberships';

import { GuestsController } from './people.controller';
import { PeopleService } from './people.service';

@Module({
  imports: [MembershipsModule, InvitesModule],
  controllers: [GuestsController],
  providers: [PeopleService],
  exports: [PeopleService],
})
export class PeopleModule {}
