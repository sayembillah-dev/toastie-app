import type { Asset as AssetRow, LibraryDocument as LibraryDocumentRow } from '@prisma/client';

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
