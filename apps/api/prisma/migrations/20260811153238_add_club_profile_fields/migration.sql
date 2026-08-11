-- AlterTable
ALTER TABLE "Club" ADD COLUMN     "motto" TEXT,
ADD COLUMN     "venueAddress" TEXT,
ADD COLUMN     "venueMapUrl" TEXT,
ADD COLUMN     "socials" JSONB NOT NULL DEFAULT '[]';
