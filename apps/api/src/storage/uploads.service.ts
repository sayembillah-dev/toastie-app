import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { can, type PermissionSubject } from '@toastly/access';

import type { SignUploadDto } from './dto/uploads.dto';
import type { SignedUpload } from './storage.service';
import { StorageService } from './storage.service';
import { INLINE_MAX_BYTES, SURFACE_RULES } from './storage.types';

/** Policy in front of `StorageService.signUpload`.
 *
 * Handing out a presigned PUT is a write, so it gets the same scrutiny as the
 * row that will eventually point at it: the caller must hold the surface's
 * resource in the target club, and the file must be a type and size that
 * surface accepts. Without this the endpoint would be an open write handle to
 * the bucket for anyone with a login. */
@Injectable()
export class UploadsService {
  constructor(private readonly storage: StorageService) {}

  async sign(
    subject: PermissionSubject,
    clubId: string | null,
    dto: SignUploadDto,
  ): Promise<SignedUpload> {
    const rule = SURFACE_RULES[dto.surface];

    if (!rule.mimeTypes.includes(dto.mimeType)) {
      throw new BadRequestException(
        `"${dto.mimeType}" is not an accepted file type for ${dto.surface}`,
      );
    }
    // The surface caps assume object storage. On `local-db` the bytes become a
    // base64 column value instead, which has a much lower practical ceiling —
    // take whichever applies so the user is told the real limit up front.
    const limit = this.storage.isS3 ? rule.maxBytes : Math.min(rule.maxBytes, INLINE_MAX_BYTES);
    if (dto.sizeBytes > limit) {
      const mb = Math.floor(limit / (1024 * 1024));
      throw new BadRequestException(`File is too large — the limit is ${mb} MB`);
    }

    // Self-scoped surfaces (a member's own avatar) need no grant: the key is
    // built from the caller's own id, so there is no other tenant to reach.
    if (rule.scope === 'user') {
      return this.storage.signUpload({
        surface: dto.surface,
        scopeId: subject.userId,
        mimeType: dto.mimeType,
      });
    }

    if (!clubId) {
      throw new BadRequestException(
        'No active club context — set the X-Toastly-Context header before uploading',
      );
    }
    // `create` OR `update`: one upload flow serves both attaching a file to a
    // new row and replacing the file on an existing one, and a user who can
    // do either can legitimately put bytes in the bucket.
    const allowed = rule.resource
      ? rule.actions.some((action) => can(subject, action, rule.resource!, { clubId }))
      : false;
    if (!allowed) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        resource: rule.resource,
        action: rule.actions.join('|'),
        reason: 'You do not manage this club',
      });
    }

    return this.storage.signUpload({
      surface: dto.surface,
      scopeId: clubId,
      mimeType: dto.mimeType,
    });
  }
}
