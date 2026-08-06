-- S12 — Library, inventory, finance, activity. Adds the operational tables
-- the API serves once `NEXT_PUBLIC_LIVE_DOMAINS` picks up any of these four
-- domains, and finishes the cutover: the web's `lib/local-db/` deletion
-- follows in the same PR.
--
-- Every operational row carries `clubId`. `ChecklistItem`, `DuesRecord` and
-- `Task` use composite tenant FKs (`Meeting.(clubId, id)` /
-- `Membership.(clubId, id)`) so a cross-tenant reference is a schema error,
-- not a bug caught in review. `ActivityLog.actorMembershipId` is a soft
-- reference — a departing member must not erase the audit trail, and a
-- composite-FK SetNull would null the tenant `clubId` too.

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Asset_clubId_createdAt_idx" ON "Asset"("clubId", "createdAt");

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "LibraryDocument" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "LibraryDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LibraryDocument_clubId_createdAt_idx" ON "LibraryDocument"("clubId", "createdAt");

-- AddForeignKey
ALTER TABLE "LibraryDocument" ADD CONSTRAINT "LibraryDocument_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "imageMimeType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InventoryItem_clubId_createdAt_idx" ON "InventoryItem"("clubId", "createdAt");

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "ChecklistItem" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "ChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChecklistItem_clubId_meetingId_idx" ON "ChecklistItem"("clubId", "meetingId");

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_clubId_meetingId_fkey" FOREIGN KEY ("clubId", "meetingId") REFERENCES "Meeting"("clubId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "counterparty" TEXT,
    "reference" TEXT,
    "duesRecordId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_duesRecordId_key" ON "Transaction"("duesRecordId");

-- CreateIndex
CREATE INDEX "Transaction_clubId_date_idx" ON "Transaction"("clubId", "date");

-- CreateIndex
CREATE INDEX "Transaction_clubId_category_idx" ON "Transaction"("clubId", "category");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "DuesRecord" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "amountDueMinor" INTEGER NOT NULL,
    "amountPaidMinor" INTEGER NOT NULL DEFAULT 0,
    "waived" BOOLEAN NOT NULL DEFAULT false,
    "paidOn" TEXT,
    "method" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "DuesRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DuesRecord_clubId_periodId_membershipId_key" ON "DuesRecord"("clubId", "periodId", "membershipId");

-- CreateIndex
CREATE INDEX "DuesRecord_clubId_periodId_idx" ON "DuesRecord"("clubId", "periodId");

-- AddForeignKey
ALTER TABLE "DuesRecord" ADD CONSTRAINT "DuesRecord_clubId_membershipId_fkey" FOREIGN KEY ("clubId", "membershipId") REFERENCES "Membership"("clubId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey (linked ledger row → dues record)
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_duesRecordId_fkey" FOREIGN KEY ("duesRecordId") REFERENCES "DuesRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "BudgetLine" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "fiscalYear" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "plannedMinor" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "BudgetLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BudgetLine_clubId_fiscalYear_category_key" ON "BudgetLine"("clubId", "fiscalYear", "category");

-- CreateIndex
CREATE INDEX "BudgetLine_clubId_fiscalYear_idx" ON "BudgetLine"("clubId", "fiscalYear");

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "assignedBy" TEXT NOT NULL,
    "dueDate" TEXT,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Task_clubId_membershipId_idx" ON "Task"("clubId", "membershipId");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_clubId_membershipId_fkey" FOREIGN KEY ("clubId", "membershipId") REFERENCES "Membership"("clubId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "actorMembershipId" TEXT,
    "category" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "points" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActivityLog_clubId_createdAt_idx" ON "ActivityLog"("clubId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_clubId_category_idx" ON "ActivityLog"("clubId", "category");

-- CreateIndex
CREATE INDEX "ActivityLog_clubId_actorMembershipId_idx" ON "ActivityLog"("clubId", "actorMembershipId");

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;
