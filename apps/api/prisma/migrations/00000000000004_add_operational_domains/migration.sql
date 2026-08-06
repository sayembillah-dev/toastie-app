-- S11 — Meetings, education, people. Adds the operational tables the API
-- serves once `NEXT_PUBLIC_LIVE_DOMAINS` picks up any of these three domains.
--
-- Every operational row carries `clubId`, and the tables that will grow
-- cross-child references (`Evaluation`, `TimerEntry`, `AhCounterEntry`,
-- `HistoryEvent`, `SpeechSlotRequest`, `ContactLog`, `VisitLog`) use
-- composite tenant FKs against `Membership.(clubId, id)` /
-- `Prospect.(clubId, id)` so a cross-tenant reference is a schema error,
-- not a bug caught in review.

-- CreateEnum
CREATE TYPE "MeetingStatus" AS ENUM ('draft', 'published');

-- CreateEnum
CREATE TYPE "HistoryEventType" AS ENUM ('joined', 'levelReached', 'speechGiven', 'projectStarted', 'projectCompleted', 'roleTaken');

-- CreateEnum
CREATE TYPE "SpeechSlotRequestStatus" AS ENUM ('pending', 'approved', 'declined');

-- CreateTable
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "meetingNumber" INTEGER NOT NULL,
    "dateTime" TIMESTAMP(3) NOT NULL,
    "theme" TEXT NOT NULL,
    "status" "MeetingStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Meeting_clubId_id_key" ON "Meeting"("clubId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Meeting_clubId_meetingNumber_key" ON "Meeting"("clubId", "meetingNumber");

-- CreateIndex
CREATE INDEX "Meeting_clubId_dateTime_idx" ON "Meeting"("clubId", "dateTime");

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "HistoryEvent" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "type" "HistoryEventType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "meetingNumber" INTEGER,
    "role" TEXT,
    "title" TEXT,
    "projectName" TEXT,
    "level" INTEGER,
    "pathway" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HistoryEvent_clubId_membershipId_idx" ON "HistoryEvent"("clubId", "membershipId");

-- CreateIndex
CREATE INDEX "HistoryEvent_clubId_date_idx" ON "HistoryEvent"("clubId", "date");

-- AddForeignKey
ALTER TABLE "HistoryEvent" ADD CONSTRAINT "HistoryEvent_clubId_membershipId_fkey" FOREIGN KEY ("clubId", "membershipId") REFERENCES "Membership"("clubId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "Evaluation" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "evaluatorMembershipId" TEXT NOT NULL,
    "speechEventId" TEXT NOT NULL,
    "meetingNumber" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "strengths" TEXT NOT NULL,
    "improvement" TEXT NOT NULL,
    "overallRating" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Evaluation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Evaluation_clubId_membershipId_idx" ON "Evaluation"("clubId", "membershipId");

-- CreateIndex
CREATE INDEX "Evaluation_speechEventId_idx" ON "Evaluation"("speechEventId");

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_clubId_membershipId_fkey" FOREIGN KEY ("clubId", "membershipId") REFERENCES "Membership"("clubId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_clubId_evaluatorMembershipId_fkey" FOREIGN KEY ("clubId", "evaluatorMembershipId") REFERENCES "Membership"("clubId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "TimerEntry" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "speechEventId" TEXT NOT NULL,
    "meetingNumber" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "targetMinMinutes" INTEGER NOT NULL,
    "targetMaxMinutes" INTEGER NOT NULL,
    "actualSeconds" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TimerEntry_clubId_membershipId_idx" ON "TimerEntry"("clubId", "membershipId");

-- CreateIndex
CREATE INDEX "TimerEntry_speechEventId_idx" ON "TimerEntry"("speechEventId");

-- AddForeignKey
ALTER TABLE "TimerEntry" ADD CONSTRAINT "TimerEntry_clubId_membershipId_fkey" FOREIGN KEY ("clubId", "membershipId") REFERENCES "Membership"("clubId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "AhCounterEntry" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "speechEventId" TEXT NOT NULL,
    "meetingNumber" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "fillerCounts" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AhCounterEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AhCounterEntry_clubId_membershipId_idx" ON "AhCounterEntry"("clubId", "membershipId");

-- CreateIndex
CREATE INDEX "AhCounterEntry_speechEventId_idx" ON "AhCounterEntry"("speechEventId");

-- AddForeignKey
ALTER TABLE "AhCounterEntry" ADD CONSTRAINT "AhCounterEntry_clubId_membershipId_fkey" FOREIGN KEY ("clubId", "membershipId") REFERENCES "Membership"("clubId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "SpeechSlotRequest" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "projectName" TEXT,
    "note" TEXT,
    "status" "SpeechSlotRequestStatus" NOT NULL DEFAULT 'pending',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpeechSlotRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SpeechSlotRequest_clubId_membershipId_idx" ON "SpeechSlotRequest"("clubId", "membershipId");

-- CreateIndex
CREATE INDEX "SpeechSlotRequest_clubId_meetingId_idx" ON "SpeechSlotRequest"("clubId", "meetingId");

-- AddForeignKey
ALTER TABLE "SpeechSlotRequest" ADD CONSTRAINT "SpeechSlotRequest_clubId_membershipId_fkey" FOREIGN KEY ("clubId", "membershipId") REFERENCES "Membership"("clubId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "Prospect" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "avatarUrl" TEXT,
    "socials" JSONB NOT NULL DEFAULT '[]',
    "bio" TEXT,
    "notes" TEXT,
    "firstVisit" TIMESTAMP(3),
    "lastVisit" TIMESTAMP(3),
    "visitCount" INTEGER NOT NULL DEFAULT 0,
    "invitedBy" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'new',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prospect_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Prospect_clubId_id_key" ON "Prospect"("clubId", "id");

-- CreateIndex
CREATE INDEX "Prospect_clubId_stage_idx" ON "Prospect"("clubId", "stage");

-- AddForeignKey
ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "ContactLog" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "ContactLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContactLog_clubId_prospectId_idx" ON "ContactLog"("clubId", "prospectId");

-- AddForeignKey
ALTER TABLE "ContactLog" ADD CONSTRAINT "ContactLog_clubId_prospectId_fkey" FOREIGN KEY ("clubId", "prospectId") REFERENCES "Prospect"("clubId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "VisitLog" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "meetingId" TEXT,
    "role" TEXT,
    "notes" TEXT,
    "origin" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "VisitLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VisitLog_clubId_prospectId_idx" ON "VisitLog"("clubId", "prospectId");

-- CreateIndex
CREATE INDEX "VisitLog_meetingId_idx" ON "VisitLog"("meetingId");

-- AddForeignKey
ALTER TABLE "VisitLog" ADD CONSTRAINT "VisitLog_clubId_prospectId_fkey" FOREIGN KEY ("clubId", "prospectId") REFERENCES "Prospect"("clubId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitLog" ADD CONSTRAINT "VisitLog_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;
