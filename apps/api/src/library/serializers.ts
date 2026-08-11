import type {
  Asset as AssetRow,
  LibraryDocument as LibraryDocumentRow,
  PlannerIdea as PlannerIdeaRow,
} from '@prisma/client';

import type { StorageService } from '@/storage';

/** These serializers are async because `imageUrl`/`fileUrl` no longer hold a
 * URL — they hold an S3 object key (or, until the backfill finishes, a legacy
 * inline data-URL). Turning a key into something a browser can load means
 * minting a presigned GET, and the presigner is async.
 *
 * The signing itself is a local HMAC with no network call, so a page of 12
 * assets costs 12 cheap computations rather than 12 round trips. */

/** Wire shape matches the web `lib/library/assets.ts` `Asset` interface. */
export interface AssetWire {
  id: string;
  clubId: string;
  title: string;
  imageUrl: string;
  mimeType: string;
  width: number;
  height: number;
  sizeBytes: number;
  createdAt: string;
  updatedAt?: string;
}

export async function toAssetWire(row: AssetRow, storage: StorageService): Promise<AssetWire> {
  const wire: AssetWire = {
    id: row.id,
    clubId: row.clubId,
    title: row.title,
    imageUrl: await storage.resolveUrl(row.imageUrl),
    mimeType: row.mimeType,
    width: row.width,
    height: row.height,
    sizeBytes: row.sizeBytes,
    createdAt: row.createdAt.toISOString(),
  };
  if (row.updatedAt) wire.updatedAt = row.updatedAt.toISOString();
  return wire;
}

export function toAssetWires(rows: AssetRow[], storage: StorageService): Promise<AssetWire[]> {
  return Promise.all(rows.map((row) => toAssetWire(row, storage)));
}

export interface AssetsPageWire {
  items: AssetWire[];
  total: number;
  nextOffset: number | null;
}

/** Wire shape matches the web `lib/library/documents.ts` `LibraryDocument`
 * interface. */
export interface DocumentWire {
  id: string;
  clubId: string;
  title: string;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  updatedAt?: string;
}

export async function toDocumentWire(
  row: LibraryDocumentRow,
  storage: StorageService,
): Promise<DocumentWire> {
  const wire: DocumentWire = {
    id: row.id,
    clubId: row.clubId,
    title: row.title,
    fileName: row.fileName,
    fileUrl: await storage.resolveUrl(row.fileUrl),
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    createdAt: row.createdAt.toISOString(),
  };
  if (row.updatedAt) wire.updatedAt = row.updatedAt.toISOString();
  return wire;
}

export function toDocumentWires(
  rows: LibraryDocumentRow[],
  storage: StorageService,
): Promise<DocumentWire[]> {
  return Promise.all(rows.map((row) => toDocumentWire(row, storage)));
}

export interface DocumentsPageWire {
  items: DocumentWire[];
  total: number;
  nextOffset: number | null;
}

/** Wire shape matches the web `lib/library/planner.ts` `PlannerIdea`
 * interface. */
export interface PlannerAttachmentWire {
  uid: string;
  name: string;
  /** Signed, time-limited download URL. Absent on ideas saved before planner
   * attachments carried real files — those rows recorded a filename and threw
   * the bytes away, so there is nothing to link to. */
  url?: string;
  mimeType?: string;
  sizeBytes?: number;
}

/** What actually sits in the `attachments` Json column. `key` is the S3
 * object; the wire swaps it for a signed `url` on the way out, so the key
 * never leaves the server. */
interface StoredAttachment {
  uid: string;
  name: string;
  key?: string;
  mimeType?: string;
  sizeBytes?: number;
}

export interface PlannerIdeaWire {
  id: string;
  clubId: string;
  day: string;
  title: string;
  body: string;
  attachments: PlannerAttachmentWire[];
  status: 'created' | 'drafted' | 'published';
  createdAt: string;
  updatedAt?: string;
}

export async function toPlannerIdeaWire(
  row: PlannerIdeaRow,
  storage: StorageService,
): Promise<PlannerIdeaWire> {
  const wire: PlannerIdeaWire = {
    id: row.id,
    clubId: row.clubId,
    day: row.day,
    title: row.title,
    body: row.body,
    attachments: await Promise.all(
      parsePlannerAttachments(row.attachments).map(async (entry) => {
        const out: PlannerAttachmentWire = { uid: entry.uid, name: entry.name };
        if (entry.key) out.url = await storage.resolveUrl(entry.key);
        if (entry.mimeType) out.mimeType = entry.mimeType;
        if (entry.sizeBytes !== undefined) out.sizeBytes = entry.sizeBytes;
        return out;
      }),
    ),
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
  if (row.updatedAt) wire.updatedAt = row.updatedAt.toISOString();
  return wire;
}

export function toPlannerIdeaWires(
  rows: PlannerIdeaRow[],
  storage: StorageService,
): Promise<PlannerIdeaWire[]> {
  return Promise.all(rows.map((row) => toPlannerIdeaWire(row, storage)));
}

/** The Json column is `unknown` as far as the type system is concerned, so
 * every entry is re-checked on the way out. A row written by an older shape
 * degrades to an empty list rather than crashing the whole month's fetch.
 *
 * `key` and friends are optional precisely because the older shape is still
 * out there: attachments used to be `{ uid, name }` with the bytes discarded. */
export function parsePlannerAttachments(value: unknown): StoredAttachment[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null) return [];
    const { uid, name, key, mimeType, sizeBytes } = entry as Record<string, unknown>;
    if (typeof uid !== 'string' || typeof name !== 'string') return [];
    const out: StoredAttachment = { uid, name };
    if (typeof key === 'string') out.key = key;
    if (typeof mimeType === 'string') out.mimeType = mimeType;
    if (typeof sizeBytes === 'number') out.sizeBytes = sizeBytes;
    return [out];
  });
}
