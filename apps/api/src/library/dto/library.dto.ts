import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export const ASSET_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;
export type AssetMimeType = (typeof ASSET_MIME_TYPES)[number];

export const DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'application/zip',
] as const;
export type DocumentMimeType = (typeof DOCUMENT_MIME_TYPES)[number];

export const ASSET_TITLE_MAX = 120;
export const DOCUMENT_TITLE_MAX = 120;
export const DOCUMENT_FILE_NAME_MAX = 200;
/** Upper bound on the `imageUrl`/`fileUrl` field.
 *
 * On the `s3` backend the value is a short object key and this is enormously
 * generous. It stays this size for the `local-db` backend and for rows the
 * backfill has not reached yet, where the field still carries a whole base64
 * data-URL — 4 MB of file × the 4/3 base64 blowup. Shrink it to key-sized
 * once `local-db` is retired and the backfill reports zero. */
export const DATA_URL_MAX = 6 * 1024 * 1024;

/** Body for `POST /assets`. `imageUrl` is an S3 object key obtained from
 * `POST /uploads/sign` — or, on the `local-db` backend, an inline data-URL.
 * The service pins the key to the caller's club before storing it (see
 * `StorageService.assertOwnedKey`). */
export class CreateAssetDto {
  @IsString()
  @MinLength(1)
  @MaxLength(ASSET_TITLE_MAX)
  title!: string;

  @IsString()
  @MaxLength(DATA_URL_MAX)
  imageUrl!: string;

  @IsIn(ASSET_MIME_TYPES as readonly string[])
  mimeType!: AssetMimeType;

  @IsInt()
  @Min(1)
  width!: number;

  @IsInt()
  @Min(1)
  height!: number;

  @IsInt()
  @Min(0)
  sizeBytes!: number;
}

/** Body for `PATCH /assets/:assetId`. Only the title is editable — bytes
 * are immutable once uploaded. */
export class UpdateAssetDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(ASSET_TITLE_MAX)
  title?: string;
}

export class CreateDocumentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(DOCUMENT_TITLE_MAX)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(DOCUMENT_FILE_NAME_MAX)
  fileName!: string;

  @IsString()
  @MaxLength(DATA_URL_MAX)
  fileUrl!: string;

  @IsIn(DOCUMENT_MIME_TYPES as readonly string[])
  mimeType!: DocumentMimeType;

  @IsInt()
  @Min(0)
  sizeBytes!: number;
}

export class UpdateDocumentDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(DOCUMENT_TITLE_MAX)
  title?: string;
}
