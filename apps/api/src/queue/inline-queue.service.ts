import { Injectable, Logger } from '@nestjs/common';

import { type JobName, type JobPayloads, QueueService } from './queue.service';

/** Development binding: no Redis, no worker process, no BullMQ.
 *
 * `pnpm dev` must stay a single command against Postgres alone, so this
 * implementation simply records the job and returns. It deliberately does *not*
 * execute handlers: a job that runs inline on the request thread would give
 * local development timing and failure semantics that production does not have,
 * which is a worse lie than not running it at all.
 *
 * Anything whose correctness depends on the job actually running should be
 * exercised against `APP_ENV=production` with a real Redis. */
@Injectable()
export class InlineQueueService extends QueueService {
  private readonly logger = new Logger(InlineQueueService.name);

  async enqueue<N extends JobName>(name: N, payload: JobPayloads[N]): Promise<void> {
    this.logger.debug(`[no-op] would enqueue "${name}" — Redis is disabled (APP_ENV≠production)`, {
      payload,
    });
  }
}
