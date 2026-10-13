import { Module } from '@nestjs/common';

import { WhatsappModule } from '@/whatsapp';

import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { MeetingNotificationsService } from './meeting-notifications.service';
import { MeetingsController } from './meetings.controller';
import { MeetingsService } from './meetings.service';
import { PreparedSpeakersController } from './prepared-speakers.controller';
import { PreparedSpeakersService } from './prepared-speakers.service';
import { PublicMeetingsController } from './public-meetings.controller';
import { PublicVotingController } from './public-voting.controller';
import { MeetingRolesController } from './roles.controller';
import { MeetingRolesService } from './roles.service';
import { TableTopicsController } from './table-topics.controller';
import { TableTopicsService } from './table-topics.service';
import { MeetingVotingController } from './voting.controller';
import { VotingService } from './voting.service';

@Module({
  imports: [WhatsappModule],
  controllers: [
    MeetingsController,
    PublicMeetingsController,
    MeetingRolesController,
    PreparedSpeakersController,
    TableTopicsController,
    AttendanceController,
    MeetingVotingController,
    PublicVotingController,
  ],
  providers: [
    MeetingsService,
    MeetingNotificationsService,
    MeetingRolesService,
    PreparedSpeakersService,
    TableTopicsService,
    AttendanceService,
    VotingService,
  ],
  exports: [MeetingsService, MeetingNotificationsService],
})
export class MeetingsModule {}
