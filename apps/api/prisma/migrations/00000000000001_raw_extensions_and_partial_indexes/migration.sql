-- Toastly Postgres extensions and Prisma-can't-express indexes.
--
-- 1) CITEXT — case-insensitive text for `User.email`. Prisma's
--    `String @unique` already emits a UNIQUE index, but the underlying
--    column is `text`, which is case-SENSITIVE. Converting to CITEXT gives
--    us case-insensitive lookups without a functional index or a shadow
--    column, and keeps the existing UNIQUE constraint doing its job.
--
-- 2) Two partial UNIQUE indexes. Prisma does not support `WHERE` clauses
--    on unique indexes. Without them, double-clicking `Invite` in
--    `components/club-admin/invite-modal.tsx` creates two `pending` rows
--    for the same (clubId, email), and the "accept invite → create
--    membership" flow then creates two memberships for that email.
--
-- This file lives outside Prisma's schema-drift model — a follow-up
-- `prisma migrate dev` will accept it as an applied migration.

CREATE EXTENSION IF NOT EXISTS citext;

ALTER TABLE "User" ALTER COLUMN "email" TYPE citext;

CREATE UNIQUE INDEX invite_one_pending_per_club_email
  ON "Invite" ("clubId", lower("email"))
  WHERE status = 'pending';

CREATE UNIQUE INDEX joinreq_one_pending_per_club_user
  ON "JoinRequest" ("clubId", "userId")
  WHERE status = 'pending';
