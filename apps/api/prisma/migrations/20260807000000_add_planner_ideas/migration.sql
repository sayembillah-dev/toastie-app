-- CreateEnum
CREATE TYPE "PlannerIdeaStatus" AS ENUM ('created', 'drafted', 'published');

-- CreateTable
CREATE TABLE "PlannerIdea" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "attachments" JSONB NOT NULL DEFAULT '[]',
    "status" "PlannerIdeaStatus" NOT NULL DEFAULT 'created',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "PlannerIdea_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlannerIdea_clubId_day_idx" ON "PlannerIdea"("clubId", "day");

-- AddForeignKey
ALTER TABLE "PlannerIdea" ADD CONSTRAINT "PlannerIdea_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;
