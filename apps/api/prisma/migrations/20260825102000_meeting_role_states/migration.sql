-- CreateTable
CREATE TABLE "MeetingRoleState" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "state" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingRoleState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MeetingRoleState_meetingId_kind_key" ON "MeetingRoleState"("meetingId", "kind");

-- CreateIndex
CREATE INDEX "MeetingRoleState_clubId_idx" ON "MeetingRoleState"("clubId");

-- AddForeignKey
ALTER TABLE "MeetingRoleState" ADD CONSTRAINT "MeetingRoleState_clubId_meetingId_fkey" FOREIGN KEY ("clubId", "meetingId") REFERENCES "Meeting"("clubId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
