-- AlterTable — set once, by the first publish, when the club-wide WhatsApp
-- announcement goes out.
ALTER TABLE "Meeting" ADD COLUMN "announcedAt" TIMESTAMP(3);

-- Meetings already published before announcements existed count as
-- announced, so re-publishing one of them doesn't message the whole club.
UPDATE "Meeting" SET "announcedAt" = "updatedAt" WHERE "status" = 'published';
