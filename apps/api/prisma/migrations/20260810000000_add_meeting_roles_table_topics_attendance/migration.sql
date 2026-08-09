-- CreateTable
CREATE TABLE "MeetingRoleAssignment" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "roleKey" TEXT NOT NULL,
    "membershipId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetingRoleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TableTopicQuestion" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "asked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "TableTopicQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingAttendance" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "present" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetingAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingGuestAttendance" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "present" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "MeetingGuestAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MeetingRoleAssignment_clubId_meetingId_idx" ON "MeetingRoleAssignment"("clubId", "meetingId");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingRoleAssignment_clubId_meetingId_roleKey_key" ON "MeetingRoleAssignment"("clubId", "meetingId", "roleKey");

-- CreateIndex
CREATE INDEX "TableTopicQuestion_clubId_meetingId_idx" ON "TableTopicQuestion"("clubId", "meetingId");

-- CreateIndex
CREATE INDEX "MeetingAttendance_clubId_meetingId_idx" ON "MeetingAttendance"("clubId", "meetingId");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingAttendance_clubId_meetingId_membershipId_key" ON "MeetingAttendance"("clubId", "meetingId", "membershipId");

-- CreateIndex
CREATE INDEX "MeetingGuestAttendance_clubId_meetingId_idx" ON "MeetingGuestAttendance"("clubId", "meetingId");

-- AddForeignKey
ALTER TABLE "MeetingRoleAssignment" ADD CONSTRAINT "MeetingRoleAssignment_clubId_meetingId_fkey" FOREIGN KEY ("clubId", "meetingId") REFERENCES "Meeting"("clubId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingRoleAssignment" ADD CONSTRAINT "MeetingRoleAssignment_clubId_membershipId_fkey" FOREIGN KEY ("clubId", "membershipId") REFERENCES "Membership"("clubId", "id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableTopicQuestion" ADD CONSTRAINT "TableTopicQuestion_clubId_meetingId_fkey" FOREIGN KEY ("clubId", "meetingId") REFERENCES "Meeting"("clubId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingAttendance" ADD CONSTRAINT "MeetingAttendance_clubId_meetingId_fkey" FOREIGN KEY ("clubId", "meetingId") REFERENCES "Meeting"("clubId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingAttendance" ADD CONSTRAINT "MeetingAttendance_clubId_membershipId_fkey" FOREIGN KEY ("clubId", "membershipId") REFERENCES "Membership"("clubId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingGuestAttendance" ADD CONSTRAINT "MeetingGuestAttendance_clubId_meetingId_fkey" FOREIGN KEY ("clubId", "meetingId") REFERENCES "Meeting"("clubId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
