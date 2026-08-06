import { Module } from '@nestjs/common';
import { OrgClubsController, PublicClubsController } from './clubs.controller';
import { ClubsService } from './clubs.service';

@Module({
  controllers: [PublicClubsController, OrgClubsController],
  providers: [ClubsService],
  exports: [ClubsService],
})
export class ClubsModule {}
