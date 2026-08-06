-- S13 — Public share endpoints. Meetings gain an opaque `shareToken` so
-- anonymous visitors can view specific meetings via `/public/meetings/:id
-- ?t=<token>`. The link IS the credential; a guessable id would be a data
-- leak. Rotation is a future concern (add `shareTokenIssuedAt` alongside
-- if/when the token needs to expire on demand) — the token itself is
-- always populated at row-create time in `MeetingsService.create`.
--
-- Existing rows (from seeds or earlier migrations) get a per-row cuid via
-- an in-SQL UPDATE before the NOT NULL / UNIQUE constraints go on.

-- Add nullable column so the backfill can populate before we lock down.
ALTER TABLE "Meeting" ADD COLUMN "shareToken" TEXT;

-- Backfill: two md5 salted with the meeting id give 32 hex chars of
-- entropy, uniqueness enforced by the index that goes on below. Real rows
-- written from the API get a cuid; this backfill is only load-bearing for
-- seed rows created before this migration lands.
UPDATE "Meeting"
SET "shareToken" = md5(random()::text || "id") || md5(random()::text || "id")
WHERE "shareToken" IS NULL;

-- Now lock down.
ALTER TABLE "Meeting" ALTER COLUMN "shareToken" SET NOT NULL;
CREATE UNIQUE INDEX "Meeting_shareToken_key" ON "Meeting"("shareToken");
