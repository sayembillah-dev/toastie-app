import { BadRequestException, Controller, Get, Query } from '@nestjs/common';

import { CurrentContext, type RequestContext, Requires } from '@/access';

import { ActivityService } from './activity.service';
import { ListActivityLogsQueryDto } from './dto/activity-logs.dto';
import { type ActivityLogPageWire } from './serializers';

@Controller('activity-logs')
export class ActivityLogsController {
  constructor(private readonly activity: ActivityService) {}

  @Requires('activityLog', 'read')
  @Get()
  list(
    @CurrentContext() ctx: RequestContext,
    @Query() query: ListActivityLogsQueryDto,
  ): Promise<ActivityLogPageWire> {
    const clubId = requireClubContext(ctx);
    return this.activity.list(ctx.subject, clubId, query);
  }
}

function requireClubContext(ctx: RequestContext): string {
  if (!ctx.clubId) {
    throw new BadRequestException({
      code: 'CLUB_CONTEXT_REQUIRED',
      message: 'Activity logs are only accessible from a club context',
    });
  }
  return ctx.clubId;
}
