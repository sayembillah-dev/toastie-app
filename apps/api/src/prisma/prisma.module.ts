import { Global, Module } from '@nestjs/common';

import { PrismaService } from './prisma.service';

/** `@Global` so every domain module gets `PrismaService` injected without
 * re-importing it. There is one DB in the app; a per-module Prisma provider
 * would just multiply connections. */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
