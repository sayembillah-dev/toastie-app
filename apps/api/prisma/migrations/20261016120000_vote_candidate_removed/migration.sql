-- AlterTable — an officer removing a name from a voting category now hides
-- the row instead of deleting it, so automatic top-ups don't re-add them.
ALTER TABLE "MeetingVoteCandidate" ADD COLUMN "removedAt" TIMESTAMP(3);
