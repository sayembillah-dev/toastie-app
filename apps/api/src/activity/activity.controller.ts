import { BadRequestException, Controller, Get } from '@nestjs/common';

import { CurrentContext, type RequestContext, Requires } from '@/access';

import { ActivityService } from './activity.service';
import { type ActivityLogWire } from './serializers';

@Controller('activity-logs')
export class ActivityLogsController {
  constructor(private readonly activity: ActivityService) {}

  @Requires('activityLog', 'read')
  @Get()
  list(@CurrentContext() ctx: RequestContext): Promise<ActivityLogWire[]> {
    const clubId = requireClubContext(ctx);
    return this.activity.list(ctx.subject, clubId);
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
