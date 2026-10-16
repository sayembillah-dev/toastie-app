-- AlterTable — voting gets a lifecycle (Start / Close / Reopen) and a
-- once-only marker for the WhatsApp voting link.
ALTER TABLE "Meeting" ADD COLUMN "votingOpenedAt" TIMESTAMP(3),
ADD COLUMN "votingClosedAt" TIMESTAMP(3),
ADD COLUMN "votingLinkSentAt" TIMESTAMP(3);
