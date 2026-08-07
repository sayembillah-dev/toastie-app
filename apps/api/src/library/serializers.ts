import type {
  Asset as AssetRow,
  LibraryDocument as LibraryDocumentRow,
  PlannerIdea as PlannerIdeaRow,
} from '@prisma/client';

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

export function toAssetWire(row: AssetRow): AssetWire {
  const wire: AssetWire = {
    id: row.id,
    clubId: row.clubId,
    title: row.title,
    imageUrl: row.imageUrl,
    mimeType: row.mimeType,
    width: row.width,
    height: row.height,
    sizeBytes: row.sizeBytes,
    createdAt: row.createdAt.toISOString(),
  };
  if (row.updatedAt) wire.updatedAt = row.updatedAt.toISOString();
  return wire;
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

export function toDocumentWire(row: LibraryDocumentRow): DocumentWire {
  const wire: DocumentWire = {
    id: row.id,
    clubId: row.clubId,
    title: row.title,
    fileName: row.fileName,
    fileUrl: row.fileUrl,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    createdAt: row.createdAt.toISOString(),
  };
  if (row.updatedAt) wire.updatedAt = row.updatedAt.toISOString();
  return wire;
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

export function toPlannerIdeaWire(row: PlannerIdeaRow): PlannerIdeaWire {
  const wire: PlannerIdeaWire = {
    id: row.id,
    clubId: row.clubId,
    day: row.day,
    title: row.title,
    body: row.body,
    attachments: parsePlannerAttachments(row.attachments),
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
  if (row.updatedAt) wire.updatedAt = row.updatedAt.toISOString();
  return wire;
}

/** The Json column is `unknown` as far as the type system is concerned, so
 * every entry is re-checked on the way out. A row written by an older shape
 * degrades to an empty list rather than crashing the whole month's fetch. */
function parsePlannerAttachments(value: unknown): PlannerAttachmentWire[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null) return [];
    const { uid, name } = entry as { uid?: unknown; name?: unknown };
    if (typeof uid !== 'string' || typeof name !== 'string') return [];
    return [{ uid, name }];
  });
}
