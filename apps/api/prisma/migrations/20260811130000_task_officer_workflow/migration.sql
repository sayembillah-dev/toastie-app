-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('Low', 'Medium', 'High');

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_clubId_membershipId_fkey";

-- DropIndex
DROP INDEX "Task_clubId_membershipId_idx";

-- AlterTable
ALTER TABLE "Task" DROP COLUMN "assignedBy",
DROP COLUMN "membershipId",
ADD COLUMN     "createdByMembershipId" TEXT NOT NULL,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "doneAt" TIMESTAMP(3),
ADD COLUMN     "doneByMembershipId" TEXT,
ADD COLUMN     "priority" "TaskPriority" NOT NULL DEFAULT 'Medium';

-- CreateTable
CREATE TABLE "TaskAssignee" (
    "taskId" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskAssignee_pkey" PRIMARY KEY ("taskId","membershipId")
);

-- CreateTable
CREATE TABLE "TaskNote" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskAssignee_clubId_membershipId_idx" ON "TaskAssignee"("clubId", "membershipId");

-- CreateIndex
CREATE INDEX "TaskNote_taskId_createdAt_idx" ON "TaskNote"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "TaskNote_clubId_membershipId_idx" ON "TaskNote"("clubId", "membershipId");

-- CreateIndex
CREATE INDEX "Task_clubId_idx" ON "Task"("clubId");

-- CreateIndex
CREATE INDEX "Task_clubId_createdByMembershipId_idx" ON "Task"("clubId", "createdByMembershipId");

-- CreateIndex
CREATE INDEX "Task_clubId_doneByMembershipId_idx" ON "Task"("clubId", "doneByMembershipId");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_clubId_createdByMembershipId_fkey" FOREIGN KEY ("clubId", "createdByMembershipId") REFERENCES "Membership"("clubId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_clubId_doneByMembershipId_fkey" FOREIGN KEY ("clubId", "doneByMembershipId") REFERENCES "Membership"("clubId", "id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAssignee" ADD CONSTRAINT "TaskAssignee_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAssignee" ADD CONSTRAINT "TaskAssignee_clubId_membershipId_fkey" FOREIGN KEY ("clubId", "membershipId") REFERENCES "Membership"("clubId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskNote" ADD CONSTRAINT "TaskNote_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskNote" ADD CONSTRAINT "TaskNote_clubId_membershipId_fkey" FOREIGN KEY ("clubId", "membershipId") REFERENCES "Membership"("clubId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
