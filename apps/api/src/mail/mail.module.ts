import { Global, Module } from '@nestjs/common';

import { MailService } from './mail.service';

/** Global: any feature that sends email (auth today; invites and meeting
 * reminders later) injects `MailService` without importing this module. */
@Global()
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
