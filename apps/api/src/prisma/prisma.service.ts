import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Thin lifecycle wrapper around `PrismaClient`. Nest instantiates one per
 * process and injects it into every service that needs the DB — Prisma's
 * connection pooling handles concurrency.
 *
 * `onModuleInit` connects eagerly so the first request doesn't pay the
 * connection-warmup cost. `onModuleDestroy` closes the pool on graceful
 * shutdown so dev restarts and CI runs don't leak connections into Neon's
 * concurrent-connection budget.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Prisma connected');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
