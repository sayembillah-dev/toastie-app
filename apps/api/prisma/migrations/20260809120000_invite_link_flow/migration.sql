-- AlterTable
-- The link-based invite flow generates a role-scoped join link with no
-- addressee, so `email` is no longer always known up front.
ALTER TABLE "Invite" ALTER COLUMN "email" DROP NOT NULL;

-- Rename tokenHash -> token: this column now stores the raw, shareable
-- token in plaintext (the pending-invites list re-displays the same link
-- later, which a one-way hash can't support) rather than a hash of an
-- emailed link that was never actually sent. See Invite.token in
-- schema.prisma. Existing pending rows keep whatever value they had; since
-- no accept-by-token flow existed before this migration, no real invitee
-- ever held the matching raw value for those rows.
ALTER TABLE "Invite" RENAME COLUMN "tokenHash" TO "token";
ALTER INDEX "Invite_tokenHash_key" RENAME TO "Invite_token_key";
