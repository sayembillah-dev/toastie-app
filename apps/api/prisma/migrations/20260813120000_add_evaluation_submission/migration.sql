-- DropForeignKey
ALTER TABLE "PublicEvaluationSubmission" DROP CONSTRAINT "PublicEvaluationSubmission_clubId_meetingId_fkey";

-- DropForeignKey
ALTER TABLE "PublicEvaluationSubmission" DROP CONSTRAINT "PublicEvaluationSubmission_clubId_membershipId_fkey";

-- DropTable
DROP TABLE "PublicEvaluationSubmission";

-- CreateTable
CREATE TABLE "EvaluationSubmission" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "meetingSpeakerId" TEXT NOT NULL,
    "evaluatorName" TEXT NOT NULL,
    "isAssignedEvaluator" BOOLEAN NOT NULL DEFAULT false,
    "text" TEXT,
    "audioKey" TEXT,
    "audioMimeType" TEXT,
    "audioDurationSec" INTEGER,
    "imageKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvaluationSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EvaluationSubmission_clubId_meetingSpeakerId_idx" ON "EvaluationSubmission"("clubId", "meetingSpeakerId");

-- CreateIndex
CREATE INDEX "EvaluationSubmission_clubId_meetingId_idx" ON "EvaluationSubmission"("clubId", "meetingId");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingSpeaker_clubId_id_key" ON "MeetingSpeaker"("clubId", "id");

-- AddForeignKey
ALTER TABLE "EvaluationSubmission" ADD CONSTRAINT "EvaluationSubmission_clubId_meetingId_fkey" FOREIGN KEY ("clubId", "meetingId") REFERENCES "Meeting"("clubId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationSubmission" ADD CONSTRAINT "EvaluationSubmission_clubId_meetingSpeakerId_fkey" FOREIGN KEY ("clubId", "meetingSpeakerId") REFERENCES "MeetingSpeaker"("clubId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
