import type {
  ChecklistItem as ChecklistItemRow,
  InventoryItem as InventoryItemRow,
} from '@prisma/client';

import type { StorageService } from '@/storage';

/** Wire shape matches the web `lib/inventory/inventory-items.ts`
 * `InventoryItem` interface. */
export interface InventoryItemWire {
  id: string;
  clubId: string;
  title: string;
  description?: string;
  imageUrl?: string;
  imageMimeType?: string;
  createdAt: string;
  updatedAt?: string;
}

export async function toInventoryItemWire(
  row: InventoryItemRow,
  storage: StorageService,
): Promise<InventoryItemWire> {
  const wire: InventoryItemWire = {
    id: row.id,
    clubId: row.clubId,
    title: row.title,
    createdAt: row.createdAt.toISOString(),
  };
  if (row.description) wire.description = row.description;
  if (row.imageUrl) wire.imageUrl = await storage.resolveUrl(row.imageUrl);
  if (row.imageMimeType) wire.imageMimeType = row.imageMimeType;
  if (row.updatedAt) wire.updatedAt = row.updatedAt.toISOString();
  return wire;
}

export function toInventoryItemWires(
  rows: InventoryItemRow[],
  storage: StorageService,
): Promise<InventoryItemWire[]> {
  return Promise.all(rows.map((row) => toInventoryItemWire(row, storage)));
}

/** Wire shape matches the web `lib/inventory/checklist.ts` `ChecklistItem`
 * interface. Meeting id is implicit in the URL, not repeated on the wire. */
export interface ChecklistItemWire {
  id: string;
  text: string;
  done: boolean;
}

export function toChecklistItemWire(row: ChecklistItemRow): ChecklistItemWire {
  return { id: row.id, text: row.text, done: row.done };
}
