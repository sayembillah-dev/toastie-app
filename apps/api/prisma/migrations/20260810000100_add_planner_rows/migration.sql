-- CreateTable
CREATE TABLE "PlannerRow" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "meetingNumber" INTEGER,
    "dateTime" TEXT,
    "theme" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "assignees" JSONB NOT NULL DEFAULT '{}',
    "meetingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "PlannerRow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlannerRow_clubId_createdAt_idx" ON "PlannerRow"("clubId", "createdAt");

-- CreateIndex
CREATE INDEX "PlannerRow_meetingId_idx" ON "PlannerRow"("meetingId");

-- AddForeignKey
ALTER TABLE "PlannerRow" ADD CONSTRAINT "PlannerRow_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannerRow" ADD CONSTRAINT "PlannerRow_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;
