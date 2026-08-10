-- AlterTable
-- Lets the inviting admin jot down who a join link is meant for, so the
-- pending-invites list can show more than just the role(s) granted.
ALTER TABLE "Invite" ADD COLUMN "inviteeName" TEXT;
