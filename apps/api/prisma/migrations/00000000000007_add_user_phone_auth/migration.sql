-- User auth switches from email to phone. Email becomes an optional
-- contact channel; phone becomes the required, unique login credential.
--
-- Existing rows (dev seed) get a synthetic phone derived from the id so
-- the UNIQUE index passes. Real users are (re)provisioned via the phone
-- register flow.

-- Add phone as nullable so the backfill can populate before we lock it.
ALTER TABLE "User" ADD COLUMN "phone" TEXT;

-- Deterministic synthetic phone per row: "+99" + 10-digit abs(hashtext(id)).
UPDATE "User"
SET "phone" = '+99' || lpad(abs(hashtext("id"))::text, 10, '0')
WHERE "phone" IS NULL;

-- Lock down.
ALTER TABLE "User" ALTER COLUMN "phone" SET NOT NULL;
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- Email loses its NOT NULL. The UNIQUE index and CITEXT type stay — a
-- populated email must still be unique (case-insensitively), a null
-- email is fine (Postgres UNIQUE allows multiple NULLs).
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;
