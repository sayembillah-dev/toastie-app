-- AlterTable
ALTER TABLE "MeetingRoleAssignment" ADD COLUMN     "guestId" TEXT;

-- CreateTable
CREATE TABLE "MeetingSpeaker" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'requested',
    "membershipId" TEXT,
    "guestId" TEXT,
    "evaluatorMembershipId" TEXT,
    "evaluatorGuestId" TEXT,
    "title" TEXT NOT NULL DEFAULT '',
    "duration" INTEGER,
    "pathway" TEXT,
    "project" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingSpeaker_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MeetingSpeaker_clubId_meetingId_idx" ON "MeetingSpeaker"("clubId", "meetingId");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingSpeaker_clubId_meetingId_order_key" ON "MeetingSpeaker"("clubId", "meetingId", "order");

-- CreateIndex
CREATE INDEX "MeetingRoleAssignment_clubId_guestId_idx" ON "MeetingRoleAssignment"("clubId", "guestId");

-- AddForeignKey
ALTER TABLE "MeetingRoleAssignment" ADD CONSTRAINT "MeetingRoleAssignment_clubId_guestId_fkey" FOREIGN KEY ("clubId", "guestId") REFERENCES "Prospect"("clubId", "id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingSpeaker" ADD CONSTRAINT "MeetingSpeaker_clubId_meetingId_fkey" FOREIGN KEY ("clubId", "meetingId") REFERENCES "Meeting"("clubId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingSpeaker" ADD CONSTRAINT "MeetingSpeaker_clubId_membershipId_fkey" FOREIGN KEY ("clubId", "membershipId") REFERENCES "Membership"("clubId", "id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingSpeaker" ADD CONSTRAINT "MeetingSpeaker_clubId_guestId_fkey" FOREIGN KEY ("clubId", "guestId") REFERENCES "Prospect"("clubId", "id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingSpeaker" ADD CONSTRAINT "MeetingSpeaker_clubId_evaluatorMembershipId_fkey" FOREIGN KEY ("clubId", "evaluatorMembershipId") REFERENCES "Membership"("clubId", "id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingSpeaker" ADD CONSTRAINT "MeetingSpeaker_clubId_evaluatorGuestId_fkey" FOREIGN KEY ("clubId", "evaluatorGuestId") REFERENCES "Prospect"("clubId", "id") ON DELETE SET NULL ON UPDATE CASCADE;
