import { Controller, Get } from '@nestjs/common';

import { Public } from '@/access';
import { PrismaService } from '@/prisma';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Reports process uptime plus a live `SELECT 1` against Postgres so a
   * failing connection surfaces as `db: 'down'` rather than the server
   * quietly serving stale rows. Used by the smoke test in S6's verify
   * step and by any external uptime probe.
   *
   * `version` is the deployed git SHA, injected by the PM2 ecosystem file.
   * The deploy smoke test asserts it equals the SHA it just shipped — that
   * assertion is what catches a PM2 worker still serving the previous release
   * after the `current` symlink was flipped, which a plain 200 would hide. */
  @Public()
  @Get()
  async check() {
    let db: 'up' | 'down' = 'down';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      db = 'up';
    } catch {
      db = 'down';
    }

    return {
      status: db === 'up' ? 'ok' : 'degraded',
      db,
      version: process.env.APP_VERSION ?? 'dev',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}
