/** A physical asset the club owns — banner, timing lights, gavel, etc. Tracked
 * separately from Library › Assets (which are digital files) because ownership,
 * not distribution, is what the Inventory tab is about. */

export const INVENTORY_TITLE_MAX = 120;
export const INVENTORY_DESCRIPTION_MAX = 600;

/** Cap on the uploaded image size — same budget as library assets so the data
 * URL fits comfortably inside the 5 MB per-origin localStorage quota. */
export const INVENTORY_IMAGE_MAX_BYTES = 4 * 1024 * 1024;

export const INVENTORY_IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
] as const;

export type InventoryImageMimeType = (typeof INVENTORY_IMAGE_MIME_TYPES)[number];

export function isInventoryImageMimeType(value: unknown): value is InventoryImageMimeType {
  return INVENTORY_IMAGE_MIME_TYPES.includes(value as InventoryImageMimeType);
}

export interface InventoryItem {
  id: string;
  /** Tenant boundary — the club this item belongs to. */
  clubId: string;
  title: string;
  description?: string;
  /** Data-URL (`data:image/...;base64,...`) when the user attached a photo.
   * Absent when the entry is text-only. */
  imageUrl?: string;
  imageMimeType?: InventoryImageMimeType;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateInventoryItemInput {
  title: string;
  description?: string;
  imageUrl?: string;
  imageMimeType?: InventoryImageMimeType;
}

export interface UpdateInventoryItemInput {
  title?: string;
  description?: string;
  /** `null` explicitly clears an existing image; `undefined` leaves it alone. */
  imageUrl?: string | null;
  imageMimeType?: InventoryImageMimeType | null;
}

/** Newest first — the server sorts so the grid never has to reason about order. */
export function sortInventoryItemsNewestFirst(items: readonly InventoryItem[]): InventoryItem[] {
  return [...items].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/** A handful of seeded items so a fresh browser lands with something to look at
 * rather than an empty state. */
export const SEED_INVENTORY_ITEMS: Omit<InventoryItem, 'clubId'>[] = [
  {
    id: 'inv-01',
    title: 'Club banner',
    description: 'Roll-up banner with the club logo. Kept in the storage cupboard by the podium.',
    createdAt: '2026-07-01T09:00:00.000Z',
  },
  {
    id: 'inv-02',
    title: 'Timing lights',
    description: 'Green / amber / red LED set. Two spare AA batteries inside the case.',
    createdAt: '2026-07-05T10:00:00.000Z',
  },
  {
    id: 'inv-03',
    title: 'Gavel',
    description: 'Wooden gavel and strike block. The President keeps it between meetings.',
    createdAt: '2026-07-10T11:00:00.000Z',
  },
];
