import { Global, Module } from '@nestjs/common';

import { ActivityLogsController } from './activity.controller';
import { ActivityService } from './activity.service';

/** Global module — every other domain injects `ActivityService` to record
 * events from inside its own transaction. Making it global saves 4 module
 * imports (library/inventory/finance/tasks) that would otherwise re-declare
 * the dependency. */
@Global()
@Module({
  controllers: [ActivityLogsController],
  providers: [ActivityService],
  exports: [ActivityService],
})
export class ActivityModule {}
