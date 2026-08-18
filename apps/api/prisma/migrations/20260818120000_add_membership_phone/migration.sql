-- AlterTable
ALTER TABLE "Membership" ADD COLUMN "phone" TEXT;

-- CreateIndex
CREATE INDEX "Membership_phone_idx" ON "Membership"("phone");
