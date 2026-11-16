-- One-time codes for email sign-up, email verification, password reset and
-- WhatsApp recovery. Additive only: two new enums and one new table, nothing
-- existing is altered, so a rollback to the previous build is unaffected.

-- CreateEnum
CREATE TYPE "OtpChannel" AS ENUM ('email', 'whatsapp');

-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('signup', 'verify_email', 'reset', 'whatsapp_recovery');

-- CreateTable
CREATE TABLE "OtpCode" (
    "id" TEXT NOT NULL,
    "channel" "OtpChannel" NOT NULL,
    "target" TEXT NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "userId" TEXT,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OtpCode_target_purpose_createdAt_idx" ON "OtpCode"("target", "purpose", "createdAt");

-- CreateIndex
CREATE INDEX "OtpCode_userId_idx" ON "OtpCode"("userId");

-- AddForeignKey
ALTER TABLE "OtpCode" ADD CONSTRAINT "OtpCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
