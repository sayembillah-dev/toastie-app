-- AlterTable — `prepared` (default, every existing row) keeps its current
-- behaviour; `keynote` marks an unevaluated address: title, speaker and a
-- manual duration only, no evaluator fields and no evaluation submissions.
ALTER TABLE "MeetingSpeaker" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'prepared';
