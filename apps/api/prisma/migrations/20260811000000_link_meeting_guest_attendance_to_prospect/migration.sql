-- AlterTable
ALTER TABLE "MeetingGuestAttendance" ADD COLUMN     "guestId" TEXT;

-- CreateIndex
CREATE INDEX "MeetingGuestAttendance_clubId_guestId_idx" ON "MeetingGuestAttendance"("clubId", "guestId");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingGuestAttendance_clubId_meetingId_guestId_key" ON "MeetingGuestAttendance"("clubId", "meetingId", "guestId");

-- AddForeignKey
ALTER TABLE "MeetingGuestAttendance" ADD CONSTRAINT "MeetingGuestAttendance_clubId_guestId_fkey" FOREIGN KEY ("clubId", "guestId") REFERENCES "Prospect"("clubId", "id") ON DELETE SET NULL ON UPDATE CASCADE;
