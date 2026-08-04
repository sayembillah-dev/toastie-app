/** An asset is a single image the club has uploaded to the shared library —
 * flyer, meeting photo, poster template. The Library › Assets tab reads and
 * writes exclusively through the API endpoints keyed off this shape. */

/** Hard cap on the title so a rogue paste can't stretch the search bar or blow
 * up localStorage. The upload/edit forms mirror this in their char counter. */
export const ASSET_TITLE_MAX = 120;

/** Cap on the uploaded file size. Data-URLs sit inline in localStorage and
 * anything much bigger risks pushing past the 5 MB per-origin budget. */
export const ASSET_FILE_MAX_BYTES = 4 * 1024 * 1024;

/** MIME types the upload form accepts. PNG / JPEG / WEBP / GIF covers every
 * flyer and photo we've seen in the wild without letting SVG through — SVG
 * can carry scripts and there's no browser sandbox around a data-URL <img>. */
export const ASSET_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;

export type AssetMimeType = (typeof ASSET_MIME_TYPES)[number];

export function isAssetMimeType(value: unknown): value is AssetMimeType {
  return ASSET_MIME_TYPES.includes(value as AssetMimeType);
}

/** How many assets the list endpoint returns per page. Small enough that the
 * IntersectionObserver has a chance to trigger a follow-up fetch before the
 * user runs out of images to look at. */
export const ASSETS_PAGE_SIZE = 12;

export interface Asset {
  id: string;
  title: string;
  /** Data-URL (`data:image/...;base64,...`). The local-db backend keeps the
   * bytes inline; when the real backend arrives this flips to an https URL. */
  imageUrl: string;
  mimeType: AssetMimeType;
  /** Natural pixel dimensions — the masonry column keeps its aspect box
   * without measuring the loaded image at runtime. */
  width: number;
  height: number;
  /** Byte size of the original upload. Rendered in the preview panel so the
   * viewer can decide whether to reuse or re-shoot. */
  sizeBytes: number;
  /** ISO datetime the upload landed. Drives the default sort (newest first). */
  createdAt: string;
  /** Present only when the title has been edited — powers the "edited" hint. */
  updatedAt?: string;
}

export interface CreateAssetInput {
  title: string;
  imageUrl: string;
  mimeType: AssetMimeType;
  width: number;
  height: number;
  sizeBytes: number;
}

export interface UpdateAssetInput {
  title?: string;
}

/** Page envelope for the paginated list endpoint. `nextOffset` is `null` when
 * the caller has reached the end — the infinite-scroll hook stops firing on
 * that sentinel rather than counting to `total`. */
export interface AssetsPage {
  items: Asset[];
  total: number;
  nextOffset: number | null;
}

/** Case-insensitive title match. Split out so the filter is testable and both
 * the list and the count endpoint use the same rule. */
export function matchesAssetQuery(asset: Asset, needle: string): boolean {
  return asset.title.toLowerCase().includes(needle);
}

/** Newest-first — the server sorts so the client never has to reason about
 * order across paginated windows. */
export function sortAssetsNewestFirst(assets: readonly Asset[]): Asset[] {
  return [...assets].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/** A short spread of seed assets so a fresh browser lands with something to
 * look at rather than an empty state. Bytes are cheap 1x1 placeholders — the
 * grid uses the width/height metadata for layout so the reserved slot looks
 * right even before the pixels arrive. */
const SEED_PIXEL_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

export const SEED_ASSETS: Asset[] = [
  {
    id: 'a-01',
    title: 'Spring open house flyer',
    imageUrl: SEED_PIXEL_PNG,
    mimeType: 'image/png',
    width: 1200,
    height: 1600,
    sizeBytes: 240_000,
    createdAt: '2026-07-18T09:30:00.000Z',
  },
  {
    id: 'a-02',
    title: 'Meeting hero — Table Topics night',
    imageUrl: SEED_PIXEL_PNG,
    mimeType: 'image/png',
    width: 1600,
    height: 900,
    sizeBytes: 320_000,
    createdAt: '2026-07-20T18:12:00.000Z',
  },
  {
    id: 'a-03',
    title: 'Speaker of the month — Aisha',
    imageUrl: SEED_PIXEL_PNG,
    mimeType: 'image/png',
    width: 1080,
    height: 1080,
    sizeBytes: 180_000,
    createdAt: '2026-07-22T11:00:00.000Z',
  },
  {
    id: 'a-04',
    title: 'Pathways info-card',
    imageUrl: SEED_PIXEL_PNG,
    mimeType: 'image/png',
    width: 900,
    height: 1200,
    sizeBytes: 140_000,
    createdAt: '2026-07-24T14:45:00.000Z',
  },
  {
    id: 'a-05',
    title: 'Club banner — summer social',
    imageUrl: SEED_PIXEL_PNG,
    mimeType: 'image/png',
    width: 1920,
    height: 720,
    sizeBytes: 260_000,
    createdAt: '2026-07-26T08:20:00.000Z',
  },
  {
    id: 'a-06',
    title: 'New member welcome poster',
    imageUrl: SEED_PIXEL_PNG,
    mimeType: 'image/png',
    width: 1240,
    height: 1748,
    sizeBytes: 300_000,
    createdAt: '2026-07-28T10:00:00.000Z',
  },
];
