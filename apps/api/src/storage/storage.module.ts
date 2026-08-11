import { Global, Module } from '@nestjs/common';

import { StorageService } from './storage.service';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

/** `@Global` because every domain module that owns a file column needs
 * `StorageService` in its serializers — library, users, people, inventory —
 * and threading an import into each of them buys nothing. Mirrors how
 * `PrismaModule` is wired. */
@Global()
@Module({
  controllers: [UploadsController],
  providers: [StorageService, UploadsService],
  exports: [StorageService],
})
export class StorageModule {}
