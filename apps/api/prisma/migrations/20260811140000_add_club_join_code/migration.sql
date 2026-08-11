-- AlterTable
ALTER TABLE "Club" ADD COLUMN     "joinCode" TEXT;

-- Backfill: assign each existing club a random 8-character code drawn from
-- an unambiguous alphabet (no 0/O/1/I/L), retrying per-row on collision.
DO $$
DECLARE
  club_row RECORD;
  candidate TEXT;
  alphabet TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
BEGIN
  FOR club_row IN SELECT "id" FROM "Club" LOOP
    LOOP
      candidate := (
        SELECT string_agg(substr(alphabet, (floor(random() * length(alphabet)) + 1)::int, 1), '')
        FROM generate_series(1, 8)
      );
      EXIT WHEN NOT EXISTS (SELECT 1 FROM "Club" WHERE "joinCode" = candidate);
    END LOOP;
    UPDATE "Club" SET "joinCode" = candidate WHERE "id" = club_row."id";
  END LOOP;
END $$;

-- AlterTable
ALTER TABLE "Club" ALTER COLUMN "joinCode" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Club_joinCode_key" ON "Club"("joinCode");
