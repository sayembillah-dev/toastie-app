import { Module } from '@nestjs/common';

import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { MeetingsController } from './meetings.controller';
import { MeetingsService } from './meetings.service';
import { PreparedSpeakersController } from './prepared-speakers.controller';
import { PreparedSpeakersService } from './prepared-speakers.service';
import { PublicMeetingsController } from './public-meetings.controller';
import { MeetingRolesController } from './roles.controller';
import { MeetingRolesService } from './roles.service';
import { TableTopicsController } from './table-topics.controller';
import { TableTopicsService } from './table-topics.service';

@Module({
  controllers: [
    MeetingsController,
    PublicMeetingsController,
    MeetingRolesController,
    PreparedSpeakersController,
    TableTopicsController,
    AttendanceController,
  ],
  providers: [
    MeetingsService,
    MeetingRolesService,
    PreparedSpeakersService,
    TableTopicsService,
    AttendanceService,
  ],
  exports: [MeetingsService],
})
export class MeetingsModule {}
