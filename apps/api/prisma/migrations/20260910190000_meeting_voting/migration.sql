-- CreateTable
CREATE TABLE "MeetingVoteCandidate" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "membershipId" TEXT,
    "guestId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'auto',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetingVoteCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingVoteBallot" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "voterKey" TEXT NOT NULL,
    "picks" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingVoteBallot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MeetingVoteCandidate_clubId_meetingId_idx" ON "MeetingVoteCandidate"("clubId", "meetingId");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingVoteCandidate_clubId_meetingId_category_name_key" ON "MeetingVoteCandidate"("clubId", "meetingId", "category", "name");

-- CreateIndex
CREATE INDEX "MeetingVoteBallot_clubId_meetingId_idx" ON "MeetingVoteBallot"("clubId", "meetingId");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingVoteBallot_clubId_meetingId_voterKey_key" ON "MeetingVoteBallot"("clubId", "meetingId", "voterKey");

-- AddForeignKey
ALTER TABLE "MeetingVoteCandidate" ADD CONSTRAINT "MeetingVoteCandidate_clubId_meetingId_fkey" FOREIGN KEY ("clubId", "meetingId") REFERENCES "Meeting"("clubId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingVoteCandidate" ADD CONSTRAINT "MeetingVoteCandidate_clubId_membershipId_fkey" FOREIGN KEY ("clubId", "membershipId") REFERENCES "Membership"("clubId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingVoteCandidate" ADD CONSTRAINT "MeetingVoteCandidate_clubId_guestId_fkey" FOREIGN KEY ("clubId", "guestId") REFERENCES "Prospect"("clubId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingVoteBallot" ADD CONSTRAINT "MeetingVoteBallot_clubId_meetingId_fkey" FOREIGN KEY ("clubId", "meetingId") REFERENCES "Meeting"("clubId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

