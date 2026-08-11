/**
 * Moves every legacy inline data-URL out of Postgres and into S3.
 *
 * Before object storage existed, uploaded files were base64'd into the owning
 * row's `Text` column. Those rows still work — `StorageService.resolveUrl`
 * passes a `data:` value straight through — but they bloat the database and
 * every response that carries one. This script converts them in place.
 *
 * Safe to run against a live app, and safe to run twice:
 *
 * - Rows are processed one at a time, and each is committed before the next
 *   is read. An interrupted run leaves converted rows converted; re-running
 *   picks up where it stopped.
 * - Only rows whose column starts with `data:` are touched, so a converted
 *   row is skipped on the second pass.
 * - The object is uploaded *before* the column is rewritten. A crash between
 *   the two leaves an orphaned object, never a row pointing at nothing.
 *
 * Run with `pnpm --filter @toastly/api backfill:storage`. Requires
 * FILE_STORAGE_PROVIDER=s3 and the AWS_* vars — it refuses to run otherwise,
 * since there would be nowhere to put anything.
 *
 * Once this reports 0 remaining across every table, the `isInlineRef` branch
 * in `StorageService` and the oversized `DATA_URL_MAX` DTO limits can go.
 */

import { randomUUID } from 'node:crypto';

import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const BUCKET = process.env.AWS_S3_BUCKET ?? '';
const REGION = process.env.AWS_REGION ?? '';

if (process.env.FILE_STORAGE_PROVIDER !== 's3') {
  throw new Error('FILE_STORAGE_PROVIDER must be "s3" to run the backfill — nothing to move to.');
}
if (!BUCKET || !REGION || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
  throw new Error(
    'AWS_REGION, AWS_S3_BUCKET, AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are all required.',
  );
}

const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

/** Mirrors `extensionFor` in `src/storage/storage.types.ts`. Duplicated rather
 * than imported because this script runs under plain ts-node with no Nest
 * container and no `@/` path resolution. */
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
};

interface DecodedDataUrl {
  body: Buffer;
  mimeType: string;
}

/** `data:<mime>;base64,<payload>` → bytes. Returns null for anything that is
 * not a base64 data-URL, which is how already-converted keys are skipped. */
function decodeDataUrl(value: string): DecodedDataUrl | null {
  const match = /^data:([^;,]+);base64,(.*)$/s.exec(value);
  if (!match) return null;
  return { mimeType: match[1], body: Buffer.from(match[2], 'base64') };
}

async function upload(
  scope: 'clubs' | 'users',
  scopeId: string,
  surface: string,
  decoded: DecodedDataUrl,
): Promise<string> {
  const ext = EXTENSIONS[decoded.mimeType] ?? 'bin';
  const key = `${scope}/${scopeId}/${surface}/${randomUUID()}.${ext}`;
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: decoded.body,
      ContentType: decoded.mimeType,
    }),
  );
  return key;
}

/** One column on one table. Reads only the rows that still hold a data-URL —
 * `startsWith: 'data:'` means a resumed run does no redundant work. */
async function backfillColumn(args: {
  label: string;
  surface: string;
  scope: 'clubs' | 'users';
  /** Rows still needing conversion: `{ id, scopeId, value }`. */
  load: () => Promise<Array<{ id: string; scopeId: string; value: string }>>;
  save: (id: string, key: string) => Promise<unknown>;
}): Promise<void> {
  const rows = await args.load();
  if (rows.length === 0) {
    console.log(`  ${args.label}: nothing to do`);
    return;
  }

  let moved = 0;
  let skipped = 0;
  for (const row of rows) {
    const decoded = decodeDataUrl(row.value);
    if (!decoded) {
      skipped += 1;
      continue;
    }
    const key = await upload(args.scope, row.scopeId, args.surface, decoded);
    await args.save(row.id, key);
    moved += 1;
    if (moved % 25 === 0) console.log(`  ${args.label}: ${moved}/${rows.length}`);
  }
  console.log(
    `  ${args.label}: moved ${moved}${skipped ? `, skipped ${skipped} unparseable` : ''}`,
  );
}

async function main(): Promise<void> {
  console.log(`Backfilling inline files into s3://${BUCKET}\n`);

  await backfillColumn({
    label: 'Asset.imageUrl',
    surface: 'asset',
    scope: 'clubs',
    load: async () =>
      (
        await prisma.asset.findMany({
          where: { imageUrl: { startsWith: 'data:' } },
          select: { id: true, clubId: true, imageUrl: true },
        })
      ).map((r) => ({ id: r.id, scopeId: r.clubId, value: r.imageUrl })),
    save: (id, key) => prisma.asset.update({ where: { id }, data: { imageUrl: key } }),
  });

  await backfillColumn({
    label: 'LibraryDocument.fileUrl',
    surface: 'document',
    scope: 'clubs',
    load: async () =>
      (
        await prisma.libraryDocument.findMany({
          where: { fileUrl: { startsWith: 'data:' } },
          select: { id: true, clubId: true, fileUrl: true },
        })
      ).map((r) => ({ id: r.id, scopeId: r.clubId, value: r.fileUrl })),
    save: (id, key) => prisma.libraryDocument.update({ where: { id }, data: { fileUrl: key } }),
  });

  await backfillColumn({
    label: 'User.avatarUrl',
    surface: 'avatar',
    scope: 'users',
    load: async () =>
      (
        await prisma.user.findMany({
          where: { avatarUrl: { startsWith: 'data:' } },
          select: { id: true, avatarUrl: true },
        })
      )
        // Avatars are keyed by the user themselves, so the scope is the row id.
        .map((r) => ({ id: r.id, scopeId: r.id, value: r.avatarUrl ?? '' })),
    save: (id, key) => prisma.user.update({ where: { id }, data: { avatarUrl: key } }),
  });

  await backfillColumn({
    label: 'Prospect.avatarUrl',
    surface: 'guestAvatar',
    scope: 'clubs',
    load: async () =>
      (
        await prisma.prospect.findMany({
          where: { avatarUrl: { startsWith: 'data:' } },
          select: { id: true, clubId: true, avatarUrl: true },
        })
      ).map((r) => ({ id: r.id, scopeId: r.clubId, value: r.avatarUrl ?? '' })),
    save: (id, key) => prisma.prospect.update({ where: { id }, data: { avatarUrl: key } }),
  });

  await backfillColumn({
    label: 'InventoryItem.imageUrl',
    surface: 'inventory',
    scope: 'clubs',
    load: async () =>
      (
        await prisma.inventoryItem.findMany({
          where: { imageUrl: { startsWith: 'data:' } },
          select: { id: true, clubId: true, imageUrl: true },
        })
      ).map((r) => ({ id: r.id, scopeId: r.clubId, value: r.imageUrl ?? '' })),
    save: (id, key) => prisma.inventoryItem.update({ where: { id }, data: { imageUrl: key } }),
  });

  // PlannerIdea.attachments is deliberately absent: those rows never held
  // bytes. They recorded `{ uid, name }` and discarded the file, so there is
  // nothing to move — they stay link-less until someone re-attaches.

  console.log('\nDone.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
