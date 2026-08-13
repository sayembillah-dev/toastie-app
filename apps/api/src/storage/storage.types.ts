import type { Action, ResourceKey } from '@toastly/access';
import { INVENTORY_IMAGE_MIME_TYPES } from '@/inventory/dto/inventory.dto';
import { ASSET_MIME_TYPES, DOCUMENT_MIME_TYPES } from '@/library/dto/library.dto';

/** Every place in the product that accepts an uploaded file. The surface is
 * what the client names when it asks for a signature, and it is the only
 * thing that decides which MIME types and size are allowed — so a client
 * cannot ask for a 25 MB zip and then hang it off a member's avatar. */
export const STORAGE_SURFACES = [
  'asset',
  'document',
  'planner',
  'inventory',
  'avatar',
  'guestAvatar',
  'evaluationAudio',
  'evaluationImage',
] as const;
export type StorageSurface = (typeof STORAGE_SURFACES)[number];

export function isStorageSurface(value: string): value is StorageSurface {
  return (STORAGE_SURFACES as readonly string[]).includes(value);
}

const IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;

/** `MediaRecorder`-produced audio, plus the common formats a file picker
 * (the `accept="audio/*"` fallback in `AudioTab`) might hand back. */
const AUDIO_MIME_TYPES = [
  'audio/webm',
  'audio/mp4',
  'audio/ogg',
  'audio/mpeg',
  'audio/wav',
  'audio/aac',
] as const;

const MB = 1024 * 1024;

/** What a surface permits, and who is allowed to upload to it.
 *
 * `resource`/`actions` feed the same `can()` check the owning service runs
 * when the row is finally written. Signing is checked with `create` *or*
 * `update` because one upload flow serves both — attaching a photo to a new
 * inventory item and swapping the photo on an existing one hit the same
 * endpoint, and the object is inert until a row references it.
 *
 * `scope: 'user'` marks the surfaces that belong to the caller rather than
 * to a club (a member's own avatar). Those need no resource grant — the key
 * is pinned to the caller's own id, so there is nothing to escalate. */
interface SurfaceRule {
  /** `null` for self-scoped surfaces — see `scope`. */
  resource: ResourceKey | null;
  actions: readonly Action[];
  scope: 'club' | 'user';
  mimeTypes: readonly string[];
  maxBytes: number;
}

/** Size caps are deliberately far above the old 4 MB data-URL limits: that
 * ceiling existed because the bytes rode through the API and landed in a
 * Postgres column, and neither is true any more. They are still bounded so a
 * signed URL can't be turned into free unbounded storage. */
export const SURFACE_RULES: Record<StorageSurface, SurfaceRule> = {
  asset: {
    resource: 'library',
    actions: ['create', 'update'],
    scope: 'club',
    mimeTypes: ASSET_MIME_TYPES,
    maxBytes: 15 * MB,
  },
  document: {
    resource: 'library',
    actions: ['create', 'update'],
    scope: 'club',
    mimeTypes: DOCUMENT_MIME_TYPES,
    maxBytes: 25 * MB,
  },
  planner: {
    resource: 'library',
    actions: ['create', 'update'],
    scope: 'club',
    // Planner attachments are whatever someone wants to pin to a day — a
    // venue photo as readily as a quote sheet — so both sets are allowed.
    mimeTypes: [...DOCUMENT_MIME_TYPES, ...IMAGE_MIME_TYPES],
    maxBytes: 25 * MB,
  },
  inventory: {
    resource: 'inventory',
    actions: ['create', 'update'],
    scope: 'club',
    mimeTypes: INVENTORY_IMAGE_MIME_TYPES,
    maxBytes: 10 * MB,
  },
  avatar: {
    resource: null,
    actions: [],
    scope: 'user',
    mimeTypes: IMAGE_MIME_TYPES,
    maxBytes: 5 * MB,
  },
  guestAvatar: {
    resource: 'guest',
    actions: ['create', 'update'],
    scope: 'club',
    mimeTypes: IMAGE_MIME_TYPES,
    maxBytes: 5 * MB,
  },
  // Not reachable via the authenticated `/uploads/sign` endpoint — see the
  // explicit rejection in `UploadsService.sign`. Signed only by
  // `PublicEvaluationsController`, gated by the meeting's share token rather
  // than a permission grant, since the caller is anonymous.
  evaluationAudio: {
    resource: null,
    actions: [],
    scope: 'club',
    mimeTypes: AUDIO_MIME_TYPES,
    maxBytes: 25 * MB,
  },
  evaluationImage: {
    resource: null,
    actions: [],
    scope: 'club',
    mimeTypes: IMAGE_MIME_TYPES,
    maxBytes: 12 * MB,
  },
};

/** Ceiling for a file on the `local-db` backend, where the bytes become a
 * base64 column value rather than an S3 object.
 *
 * The per-surface `maxBytes` above assume object storage and are far larger.
 * They cannot apply here: 25 MB inlined is ~34 MB of text in a row, past both
 * `DATA_URL_MAX` on the DTOs and the 25 MB body limit Caddy enforces in front
 * of the API. Rejecting at sign time gives the user "the limit is 4 MB"
 * instead of a validation error about string length. */
export const INLINE_MAX_BYTES = 4 * MB;

/** Extension appended to the generated key. Purely cosmetic — nothing reads
 * it back, the MIME type is stored on the row — but it makes the bucket
 * browsable in the S3 console, which matters the first time something needs
 * debugging by hand. */
const EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'application/zip': 'zip',
  'audio/webm': 'webm',
  'audio/mp4': 'm4a',
  'audio/ogg': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/aac': 'aac',
};

/** `MediaRecorder.mimeType` carries a codecs parameter (e.g.
 * `audio/webm;codecs=opus`) that a plain-string mime-type list or extension
 * lookup won't match — strip it before comparing against either. */
export function stripCodecs(mimeType: string): string {
  const idx = mimeType.indexOf(';');
  return idx === -1 ? mimeType : mimeType.slice(0, idx);
}

export function extensionFor(mimeType: string): string {
  return EXTENSIONS[stripCodecs(mimeType)] ?? 'bin';
}

/** True when a stored column value is a legacy inline data-URL rather than an
 * object key.
 *
 * This is the whole of the dual-read strategy. Both forms live in the same
 * column while the backfill runs; `data:` is not a legal key prefix (keys are
 * always `clubs/…` or `users/…`), so the discriminator is unambiguous. Delete
 * this function and its callers once the backfill reports zero rows left. */
export function isInlineRef(stored: string): boolean {
  return stored.startsWith('data:');
}
