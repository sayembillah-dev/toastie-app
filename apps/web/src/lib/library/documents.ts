/** A library document is any non-image file the club keeps on the shared
 * shelf — meeting minutes, agendas, member handbooks, spreadsheets. The
 * Library › Documents tab reads and writes exclusively through the API
 * endpoints keyed off this shape. */

/** Hard cap on the title so a rogue paste can't stretch the search bar or blow
 * up localStorage. The upload/edit forms mirror this in their char counter. */
export const DOCUMENT_TITLE_MAX = 120;

/** Cap on the uploaded file size. Data-URLs sit inline in localStorage and
 * anything much bigger risks pushing past the 5 MB per-origin budget. */
export const DOCUMENT_FILE_MAX_BYTES = 4 * 1024 * 1024;

/** MIME types the upload form accepts. Covers the common office trio, PDF,
 * plain text/CSV and zipped bundles — enough for meeting packs, minutes and
 * member handouts without letting anything executable through. */
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

export function isDocumentMimeType(value: unknown): value is DocumentMimeType {
  return DOCUMENT_MIME_TYPES.includes(value as DocumentMimeType);
}

/** How many documents the list endpoint returns per page. Small enough that
 * the IntersectionObserver has a chance to trigger a follow-up fetch before
 * the user runs out of rows to look at. */
export const DOCUMENTS_PAGE_SIZE = 12;

export interface LibraryDocument {
  id: string;
  /** Tenant boundary — the club this document belongs to. */
  clubId: string;
  title: string;
  /** Original filename as picked from the OS. Kept alongside `title` so a
   * rename in the app does not lose the on-disk name and its extension. */
  fileName: string;
  /** Data-URL (`data:<mime>;base64,...`). The local-db backend keeps the
   * bytes inline; when the real backend arrives this flips to an https URL. */
  fileUrl: string;
  mimeType: DocumentMimeType;
  /** Byte size of the original upload. Rendered on every row / card so the
   * viewer can decide whether to open before downloading. */
  sizeBytes: number;
  /** ISO datetime the upload landed. Drives the default sort (newest first). */
  createdAt: string;
  /** Present only when the title has been edited — powers the "edited" hint. */
  updatedAt?: string;
}

export interface CreateDocumentInput {
  title: string;
  fileName: string;
  fileUrl: string;
  mimeType: DocumentMimeType;
  sizeBytes: number;
}

export interface UpdateDocumentInput {
  title?: string;
}

/** Page envelope for the paginated list endpoint. `nextOffset` is `null` when
 * the caller has reached the end — the infinite-scroll hook stops firing on
 * that sentinel rather than counting to `total`. */
export interface DocumentsPage {
  items: LibraryDocument[];
  total: number;
  nextOffset: number | null;
}

/** Case-insensitive title or filename match — a viewer searching for
 * "minutes" should hit both a document titled "March minutes" and one whose
 * upload happened to be `minutes-2026-03.pdf`. */
export function matchesDocumentQuery(doc: LibraryDocument, needle: string): boolean {
  return doc.title.toLowerCase().includes(needle) || doc.fileName.toLowerCase().includes(needle);
}

/** Newest-first — the server sorts so the client never has to reason about
 * order across paginated windows. */
export function sortDocumentsNewestFirst(docs: readonly LibraryDocument[]): LibraryDocument[] {
  return [...docs].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/** Human label for a MIME type — drives the type chip on both grid and list
 * views. Everything unknown collapses to "File" so the UI never leaks the
 * raw `application/vnd.…` string. */
export function documentTypeLabel(mimeType: DocumentMimeType): string {
  switch (mimeType) {
    case 'application/pdf':
      return 'PDF';
    case 'application/msword':
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return 'Word';
    case 'application/vnd.ms-excel':
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      return 'Excel';
    case 'application/vnd.ms-powerpoint':
    case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
      return 'PowerPoint';
    case 'text/plain':
      return 'Text';
    case 'text/csv':
      return 'CSV';
    case 'application/zip':
      return 'Zip';
  }
}

/** Extension used when a viewer downloads the file. Prefers the extension
 * off the original filename so `report.docx` stays `.docx`; falls back to a
 * MIME-derived guess when the filename has none. */
export function documentExtension(doc: Pick<LibraryDocument, 'fileName' | 'mimeType'>): string {
  const match = doc.fileName.match(/\.([^.]+)$/);
  if (match) return match[1].toLowerCase();
  switch (doc.mimeType) {
    case 'application/pdf':
      return 'pdf';
    case 'application/msword':
      return 'doc';
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return 'docx';
    case 'application/vnd.ms-excel':
      return 'xls';
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      return 'xlsx';
    case 'application/vnd.ms-powerpoint':
      return 'ppt';
    case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
      return 'pptx';
    case 'text/plain':
      return 'txt';
    case 'text/csv':
      return 'csv';
    case 'application/zip':
      return 'zip';
  }
}

/** A short spread of seed documents so a fresh browser lands with something
 * to look at rather than an empty state. Bytes are the smallest valid file of
 * each type — the grid uses the metadata for display so the row looks right
 * even though the payload is a stub. */
const SEED_PDF =
  'data:application/pdf;base64,JVBERi0xLjQKJcOkw7zDtsO4CjIgMCBvYmoKPDwvTGVuZ3RoIDMgMCBSL0ZpbHRlci9GbGF0ZURlY29kZT4+CnN0cmVhbQp4nDPQM1Qw0DPUUwjJLC5RcM4vzStRcMksLlEIzUsuUggN0dEHKw4A/vwLTAplbmRzdHJlYW0KZW5kb2JqCjMgMCBvYmoKNDcKZW5kb2JqCjEgMCBvYmoKPDwvVHlwZS9QYWdlL01lZGlhQm94WzAgMCAxMDAgMTAwXS9SZXNvdXJjZXM8PD4+L0NvbnRlbnRzIDIgMCBSL1BhcmVudCA0IDAgUj4+CmVuZG9iago0IDAgb2JqCjw8L1R5cGUvUGFnZXMvS2lkc1sxIDAgUl0vQ291bnQgMT4+CmVuZG9iago1IDAgb2JqCjw8L1R5cGUvQ2F0YWxvZy9QYWdlcyA0IDAgUj4+CmVuZG9iagp4cmVmCjAgNgowMDAwMDAwMDAwIDY1NTM1IGYNCjAwMDAwMDAxMzcgMDAwMDAgbg0KMDAwMDAwMDAxNSAwMDAwMCBuDQowMDAwMDAwMTE4IDAwMDAwIG4NCjAwMDAwMDAyMTggMDAwMDAgbg0KMDAwMDAwMDI2MyAwMDAwMCBuDQp0cmFpbGVyCjw8L1NpemUgNi9Sb290IDUgMCBSPj4Kc3RhcnR4cmVmCjMxMAolJUVPRgo=';
const SEED_TEXT = 'data:text/plain;base64,VG9hc3RpZSBjbHViIHN0dWIgZmlsZS4=';

export const SEED_DOCUMENTS: Omit<LibraryDocument, 'clubId'>[] = [
  {
    id: 'd-01',
    title: 'Club bylaws — 2026 revision',
    fileName: 'club-bylaws-2026.pdf',
    fileUrl: SEED_PDF,
    mimeType: 'application/pdf',
    sizeBytes: 184_000,
    createdAt: '2026-07-19T08:15:00.000Z',
  },
  {
    id: 'd-02',
    title: 'Meeting minutes — July',
    fileName: 'minutes-2026-07.pdf',
    fileUrl: SEED_PDF,
    mimeType: 'application/pdf',
    sizeBytes: 92_000,
    createdAt: '2026-07-21T18:30:00.000Z',
  },
  {
    id: 'd-03',
    title: 'New member checklist',
    fileName: 'new-member-checklist.txt',
    fileUrl: SEED_TEXT,
    mimeType: 'text/plain',
    sizeBytes: 1_200,
    createdAt: '2026-07-23T09:45:00.000Z',
  },
  {
    id: 'd-04',
    title: 'Officer handoff pack',
    fileName: 'officer-handoff.pdf',
    fileUrl: SEED_PDF,
    mimeType: 'application/pdf',
    sizeBytes: 460_000,
    createdAt: '2026-07-25T11:00:00.000Z',
  },
  {
    id: 'd-05',
    title: 'Budget tracker — Q3',
    fileName: 'budget-q3.csv',
    fileUrl: 'data:text/csv;base64,SXRlbSxBbW91bnQKUm9vbSxCbGFuayBkYXk=',
    mimeType: 'text/csv',
    sizeBytes: 4_800,
    createdAt: '2026-07-27T14:20:00.000Z',
  },
  {
    id: 'd-06',
    title: 'Pathways reference sheet',
    fileName: 'pathways-reference.pdf',
    fileUrl: SEED_PDF,
    mimeType: 'application/pdf',
    sizeBytes: 220_000,
    createdAt: '2026-07-29T10:10:00.000Z',
  },
];
