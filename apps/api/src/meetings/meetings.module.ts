import { Module } from '@nestjs/common';

import { MeetingsController } from './meetings.controller';
import { MeetingsService } from './meetings.service';
import { PublicMeetingsController } from './public-meetings.controller';

@Module({
  controllers: [MeetingsController, PublicMeetingsController],
  providers: [MeetingsService],
  exports: [MeetingsService],
})
export class MeetingsModule {}
