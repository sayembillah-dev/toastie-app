import { IsIn, IsInt, IsString, Min } from 'class-validator';

import { STORAGE_SURFACES, type StorageSurface } from '../storage.types';

/** Body for `POST /uploads/sign`.
 *
 * `sizeBytes` is what the client *says* it is about to upload. It cannot be
 * baked into the signature, so it is not a guarantee — it is a cheap early
 * rejection so a user picking a 400 MB file is told immediately rather than
 * after the upload. The binding limit is the surface's `maxBytes`, re-checked
 * against the real object when the row is written. */
export class SignUploadDto {
  @IsIn(STORAGE_SURFACES as readonly string[])
  surface!: StorageSurface;

  @IsString()
  mimeType!: string;

  @IsInt()
  @Min(1)
  sizeBytes!: number;
}
