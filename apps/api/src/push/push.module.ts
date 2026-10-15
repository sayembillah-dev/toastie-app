import { Module } from '@nestjs/common';

import { DevicesController } from './devices.controller';
import { NativePushService } from './native-push.service';
import { PushController } from './push.controller';
import { PushService } from './push.service';

@Module({
  controllers: [PushController, DevicesController],
  providers: [PushService, NativePushService],
  exports: [PushService, NativePushService],
})
export class PushModule {}
