import { Module } from '@nestjs/common';

import { LibraryController } from './library.controller';
import { LibraryService } from './library.service';

@Module({
  controllers: [LibraryController],
  providers: [LibraryService],
  exports: [LibraryService],
})
export class LibraryModule {}
