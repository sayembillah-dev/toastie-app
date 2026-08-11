import { randomUUID } from 'node:crypto';

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { FileStorageProvider } from '@/config';

import { extensionFor, isInlineRef, type StorageSurface, SURFACE_RULES } from './storage.types';

/** What the client gets back from `POST /uploads/sign`.
 *
 * A discriminated union rather than two endpoints so the web upload helper
 * has one code path: it asks for a signature and does what it is told. On the
 * `local-db` backend the answer is "there is nowhere to put this — inline it
 * yourself", which is exactly what the app did everywhere before S3. */
export type SignedUpload =
  | { mode: 's3'; url: string; key: string; expiresInSeconds: number }
  | { mode: 'inline' };

const DEFAULT_GET_TTL = 900; // 15 minutes
const DEFAULT_PUT_TTL = 300; // 5 minutes

/** Object storage for every uploaded file in the product.
 *
 * Two backends behind one interface (see `FileStorageProvider`). The `s3`
 * path never moves bytes through this process: the browser is handed a
 * presigned PUT and talks to S3 directly, and reads come back as presigned
 * GETs embedded in API responses. The bucket blocks public access, so a URL
 * that leaks stops working when its signature expires.
 *
 * Presigned GETs are why the serializers are async. The alternative — an
 * app-side `/files/:id` redirect — cannot work here: auth is a Bearer token
 * from localStorage, and an `<img src>` sends no Authorization header. A
 * presigned URL carries its own credentials in the query string, so the
 * browser can fetch it with no cooperation from us. */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client | null;
  private readonly bucket: string;
  private readonly getTtl: number;
  private readonly putTtl: number;

  readonly provider: FileStorageProvider;

  constructor(private readonly config: ConfigService) {
    this.provider =
      this.config.get<FileStorageProvider>('FILE_STORAGE_PROVIDER') ?? FileStorageProvider.LocalDb;
    this.bucket = this.config.get<string>('AWS_S3_BUCKET') ?? '';
    this.getTtl = positiveInt(
      this.config.get<string>('S3_SIGNED_GET_TTL_SECONDS'),
      DEFAULT_GET_TTL,
    );
    this.putTtl = positiveInt(
      this.config.get<string>('S3_SIGNED_PUT_TTL_SECONDS'),
      DEFAULT_PUT_TTL,
    );

    if (this.provider === FileStorageProvider.S3) {
      // `validateEnv` already guaranteed all four are present, so this cannot
      // half-configure — see the FILE_STORAGE_PROVIDER block in env.validation.
      this.client = new S3Client({
        region: this.config.get<string>('AWS_REGION'),
        credentials: {
          accessKeyId: this.config.get<string>('AWS_ACCESS_KEY_ID') ?? '',
          secretAccessKey: this.config.get<string>('AWS_SECRET_ACCESS_KEY') ?? '',
        },
        // Without this the SDK stamps `x-amz-checksum-crc32=AAAAAA==` into
        // every presigned URL — the CRC32 of an empty body, because there are
        // no bytes at signing time. S3 ignores it (the browser never sends the
        // matching header, and uploads succeed either way), but it reads like
        // a live integrity check that is silently doing nothing. Omitting it
        // keeps the URL honest about what it actually enforces.
        requestChecksumCalculation: 'WHEN_REQUIRED',
      });
      this.logger.log(`Object storage: s3 (bucket "${this.bucket}")`);
    } else {
      this.client = null;
      this.logger.log('Object storage: local-db (files inline as data-URLs)');
    }
  }

  get isS3(): boolean {
    return this.provider === FileStorageProvider.S3 && this.client !== null;
  }

  /** Mints a presigned PUT for one file.
   *
   * What this signature does and does not constrain, measured rather than
   * assumed: the minted URL carries `X-Amz-SignedHeaders=host`, so **only the
   * bucket, key and expiry are enforced**. `ContentType` below sets the
   * object's stored metadata, but it is not part of the signature — a client
   * that PUTs `application/zip` against a URL signed for `image/png` is
   * accepted, and the object is stored as a zip. Content length is not
   * constrained either, so `sizeBytes` on the sign request is an early
   * rejection for the user's benefit, not a limit.
   *
   * What *is* enforced: the key. It is server-generated and scoped to the
   * caller (`buildKey`), and re-checked against the owning row's club by
   * `assertOwnedKey`, so nobody can write outside their own tenant prefix or
   * overwrite an existing object.
   *
   * Closing the type/size gap needs a presigned POST with policy conditions
   * (`content-length-range`, `Content-Type`) instead of a PUT — that changes
   * the browser leg to a multipart form. Worth doing if untrusted users ever
   * get upload rights; today every uploader is a vetted club officer. */
  async signUpload(args: {
    surface: StorageSurface;
    scopeId: string;
    mimeType: string;
  }): Promise<SignedUpload> {
    if (!this.isS3 || !this.client) return { mode: 'inline' };

    const key = this.buildKey(args.surface, args.scopeId, args.mimeType);
    const url = await getSignedUrl(
      this.client,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: args.mimeType }),
      { expiresIn: this.putTtl },
    );
    return { mode: 's3', url, key, expiresInSeconds: this.putTtl };
  }

  /** Turns a stored column value into something a browser can load.
   *
   * Legacy inline data-URLs pass through untouched — that is the dual-read
   * branch, and it is what lets this ship before the backfill has run. */
  async resolveUrl(stored: string): Promise<string> {
    if (isInlineRef(stored)) return stored;
    if (!this.isS3 || !this.client) return stored;

    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: stored }), {
      expiresIn: this.getTtl,
    });
  }

  /** Null-tolerant `resolveUrl`, for the optional columns (avatars, inventory
   * photos) where "no file" is the common case. */
  async resolveOptional(stored: string | null | undefined): Promise<string | null> {
    if (!stored) return null;
    return this.resolveUrl(stored);
  }

  /** Rejects a key that does not belong to the scope it is being attached to.
   *
   * Without this the signing check is bypassable end-to-end: a user signs a
   * legitimate upload for their own club, then POSTs some *other* club's key
   * as `imageUrl`. `resolveUrl` signs whatever the column holds, so the
   * response would hand them a working GET for a file they cannot otherwise
   * reach. The random component makes guessing a key impractical, but "hard
   * to guess" is not an access control — this is.
   *
   * Legacy inline values pass through: they carry their bytes with them and
   * have no key to scope. */
  assertOwnedKey(stored: string, surface: StorageSurface, scopeId: string): void {
    if (isInlineRef(stored)) return;
    if (!this.isS3) return;

    const prefix = SURFACE_RULES[surface].scope === 'club' ? 'clubs' : 'users';
    if (!stored.startsWith(`${prefix}/${scopeId}/${surface}/`)) {
      throw new BadRequestException('That file reference does not belong here');
    }
  }

  /** Best-effort object removal when a row is deleted or its file replaced.
   *
   * Deliberately swallows failures. The row is already gone by the time this
   * runs, so throwing would fail a delete the user watched succeed; the worst
   * case is an orphaned object, which a bucket lifecycle rule can sweep. */
  async remove(stored: string | null | undefined): Promise<void> {
    if (!stored || isInlineRef(stored)) return;
    if (!this.isS3 || !this.client) return;

    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: stored }));
    } catch (error) {
      this.logger.warn(`Could not delete object "${stored}": ${String(error)}`);
    }
  }

  /** `clubs/<clubId>/assets/<uuid>.png`, or `users/<userId>/avatar/<uuid>.jpg`.
   *
   * Tenant-prefixed on purpose: it makes "delete everything belonging to this
   * club" a prefix operation, and it makes a stray object obvious in the
   * console. The random component is server-generated so a client can never
   * choose a key and overwrite somebody else's file. */
  private buildKey(surface: StorageSurface, scopeId: string, mimeType: string): string {
    const prefix = SURFACE_RULES[surface].scope === 'club' ? 'clubs' : 'users';
    return `${prefix}/${scopeId}/${surface}/${randomUUID()}.${extensionFor(mimeType)}`;
  }
}

function positiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}
