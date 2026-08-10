import { type DynamicModule, Global, Logger, Module } from '@nestjs/common';

import { AppEnv } from '../config';

import { InlineQueueService } from './inline-queue.service';
import { QueueService } from './queue.service';

/** The single place where "is this environment allowed to talk to Redis?" is
 * decided. (`noStaticOnlyClass` is disabled for apps/api in biome.json —
 * Nest's `DynamicModule` contract requires a class with a static factory.)
 *
 * Gating on `APP_ENV` rather than `NODE_ENV` is deliberate — see
 * `config/env.validation.ts`. `REDIS_URL` is already a hard boot requirement
 * when `APP_ENV=production`, so the production branch can trust it exists.
 *
 * To add BullMQ, the only change is inside `forRoot()`: import `BullModule`,
 * register it with `REDIS_URL` in the production branch, and bind a
 * `BullQueueService` in place of `InlineQueueService`. No consumer changes —
 * they all inject the abstract `QueueService`. */
@Global()
@Module({})
export class QueueModule {
  static forRoot(): DynamicModule {
    const isProduction = process.env.APP_ENV === AppEnv.Production;

    if (isProduction) {
      // Deliberately still the inline binding: Redis is provisioned on the VPS
      // but no job types exist yet (`JobPayloads` is empty, so `enqueue()` is
      // uncallable). Swapping this for the BullMQ binding is the last step of
      // the Redis rollout — until then production behaves exactly as today
      // rather than depending on a queue nothing publishes to.
      Logger.log(
        'APP_ENV=production — queue seam active, BullMQ binding not yet installed',
        QueueModule.name,
      );
    }

    return {
      module: QueueModule,
      providers: [{ provide: QueueService, useClass: InlineQueueService }],
      exports: [QueueService],
    };
  }
}
