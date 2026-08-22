-- AlterTable
ALTER TABLE "Club" ADD COLUMN     "guestInviteToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Club_guestInviteToken_key" ON "Club"("guestInviteToken");
