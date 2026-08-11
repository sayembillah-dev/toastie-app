import { Body, Controller, Post } from '@nestjs/common';

// Concrete files rather than the `@/access` barrel — the barrel re-exports
// AccessModule, whose SubjectFactory depends on StorageService, and importing
// it from a module this one owns would close the cycle back onto itself.
import { type RequestContext } from '@/access/context.guard';
import { CurrentContext } from '@/access/current-context.decorator';

import { SignUploadDto } from './dto/uploads.dto';
import type { SignedUpload } from './storage.service';
import { UploadsService } from './uploads.service';

/** Deliberately carries no `@Requires` decorator: the resource being checked
 * depends on the surface in the body, which the guard cannot see. The check
 * runs in `UploadsService.sign` instead — see the note there. */
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post('sign')
  sign(@CurrentContext() ctx: RequestContext, @Body() dto: SignUploadDto): Promise<SignedUpload> {
    return this.uploads.sign(ctx.subject, ctx.lineage.clubId ?? ctx.clubId, dto);
  }
}
