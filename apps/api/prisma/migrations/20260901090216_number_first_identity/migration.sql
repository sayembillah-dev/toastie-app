-- AlterTable
ALTER TABLE "AhCounterEntry" ADD COLUMN     "guestId" TEXT,
ALTER COLUMN "membershipId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Evaluation" ADD COLUMN     "guestId" TEXT,
ALTER COLUMN "membershipId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Membership" ADD COLUMN     "personId" TEXT;

-- AlterTable
ALTER TABLE "Prospect" ADD COLUMN     "personId" TEXT;

-- AlterTable
ALTER TABLE "TimerEntry" ADD COLUMN     "guestId" TEXT,
ALTER COLUMN "membershipId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "email" SET DATA TYPE TEXT;

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "bio" TEXT,
    "avatarUrl" TEXT,
    "whatsapp" TEXT,
    "organization" TEXT,
    "socials" JSONB NOT NULL DEFAULT '[]',
    "userId" TEXT,
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Person_phone_key" ON "Person"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Person_userId_key" ON "Person"("userId");

-- CreateIndex
CREATE INDEX "Person_userId_idx" ON "Person"("userId");

-- CreateIndex
CREATE INDEX "AhCounterEntry_clubId_guestId_idx" ON "AhCounterEntry"("clubId", "guestId");

-- CreateIndex
CREATE INDEX "Evaluation_clubId_guestId_idx" ON "Evaluation"("clubId", "guestId");

-- CreateIndex
CREATE INDEX "Membership_personId_idx" ON "Membership"("personId");

-- CreateIndex
CREATE INDEX "Prospect_personId_idx" ON "Prospect"("personId");

-- CreateIndex
CREATE INDEX "TimerEntry_clubId_guestId_idx" ON "TimerEntry"("clubId", "guestId");

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_clubId_guestId_fkey" FOREIGN KEY ("clubId", "guestId") REFERENCES "Prospect"("clubId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimerEntry" ADD CONSTRAINT "TimerEntry_clubId_guestId_fkey" FOREIGN KEY ("clubId", "guestId") REFERENCES "Prospect"("clubId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AhCounterEntry" ADD CONSTRAINT "AhCounterEntry_clubId_guestId_fkey" FOREIGN KEY ("clubId", "guestId") REFERENCES "Prospect"("clubId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
