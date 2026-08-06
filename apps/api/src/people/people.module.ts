import { Module } from '@nestjs/common';

import { GuestsController } from './people.controller';
import { PeopleService } from './people.service';

@Module({
  controllers: [GuestsController],
  providers: [PeopleService],
  exports: [PeopleService],
})
export class PeopleModule {}
