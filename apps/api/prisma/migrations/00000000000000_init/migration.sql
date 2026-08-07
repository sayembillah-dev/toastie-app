-- Baseline for a fresh install. Consolidates the incremental S1-S13
-- schema deltas into one CREATE-everything migration. Includes the
-- raw-SQL bits (CITEXT for User.email, partial UNIQUE indexes on
-- Invite + JoinRequest) at the end because Prisma can't express
-- either in its schema DSL.
--
-- The historical per-slice migrations lived in 00000000000001-7 and
-- are now folded in here; `_prisma_migrations` on an existing DB
-- may still list them as applied — that's fine, Prisma ignores
-- ghost history that isn't in the folder.

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'suspended');

-- CreateEnum
CREATE TYPE "ClubDirectoryStatus" AS ENUM ('active', 'low', 'suspended');

-- CreateEnum
CREATE TYPE "ClubLifecycle" AS ENUM ('active', 'inactive', 'chartered');

-- CreateEnum
CREATE TYPE "ClubJoinPolicy" AS ENUM ('request', 'closed', 'open');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('active', 'removed');

-- CreateEnum
CREATE TYPE "ClubRole" AS ENUM ('ClubAdmin', 'Guest', 'IPP', 'Member', 'President', 'Secretary', 'SergeantAtArms', 'Treasurer', 'VPEducation', 'VPMembership', 'VPPR');

-- CreateEnum
CREATE TYPE "OrgRole" AS ENUM ('AreaDirector', 'DivisionDirector', 'DistrictDirector');

-- CreateEnum
CREATE TYPE "OrgUnitType" AS ENUM ('area', 'division', 'district');

-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('pending', 'accepted', 'revoked', 'expired');

-- CreateEnum
CREATE TYPE "JoinRequestStatus" AS ENUM ('pending', 'approved', 'declined', 'withdrawn');

-- CreateEnum
CREATE TYPE "MeetingStatus" AS ENUM ('draft', 'published');

-- CreateEnum
CREATE TYPE "HistoryEventType" AS ENUM ('joined', 'levelReached', 'speechGiven', 'projectStarted', 'projectCompleted', 'roleTaken');

-- CreateEnum
CREATE TYPE "SpeechSlotRequestStatus" AS ENUM ('pending', 'approved', 'declined');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
    "emailVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "replacedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "District" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "District_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Division" (
    "id" TEXT NOT NULL,
    "districtId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Division_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Area" (
    "id" TEXT NOT NULL,
    "divisionId" TEXT NOT NULL,
    "districtId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Area_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Club" (
    "id" TEXT NOT NULL,
    "areaId" TEXT,
    "divisionId" TEXT,
    "districtId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "clubNumber" TEXT,
    "directoryStatus" "ClubDirectoryStatus" NOT NULL DEFAULT 'active',
    "lifecycle" "ClubLifecycle" NOT NULL DEFAULT 'active',
    "joinPolicy" "ClubJoinPolicy" NOT NULL DEFAULT 'request',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Club_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "userId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "roles" "ClubRole"[],
    "isClubAdmin" BOOLEAN NOT NULL DEFAULT false,
    "status" "MembershipStatus" NOT NULL DEFAULT 'active',
    "grantOverrides" JSONB NOT NULL DEFAULT '{}',
    "pathway" TEXT,
    "level" INTEGER,
    "startingLevel" INTEGER,
    "startedProject" TEXT,
    "pathwayStartedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "OrgRole" NOT NULL,
    "unitType" "OrgUnitType" NOT NULL,
    "areaId" TEXT,
    "divisionId" TEXT,
    "districtId" TEXT,
    "termStartsOn" TIMESTAMP(3),
    "termEndsOn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invite" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "roles" "ClubRole"[],
    "status" "InviteStatus" NOT NULL DEFAULT 'pending',
    "tokenHash" TEXT NOT NULL,
    "membershipId" TEXT,
    "invitedByUserId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JoinRequest" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT,
    "status" "JoinRequestStatus" NOT NULL DEFAULT 'pending',
    "decidedByMembershipId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JoinRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "meetingNumber" INTEGER NOT NULL,
    "dateTime" TIMESTAMP(3) NOT NULL,
    "theme" TEXT NOT NULL,
    "status" "MeetingStatus" NOT NULL DEFAULT 'draft',
    "shareToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoryEvent" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "type" "HistoryEventType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "meetingNumber" INTEGER,
    "role" TEXT,
    "title" TEXT,
    "projectName" TEXT,
    "level" INTEGER,
    "pathway" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evaluation" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "evaluatorMembershipId" TEXT NOT NULL,
    "speechEventId" TEXT NOT NULL,
    "meetingNumber" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "strengths" TEXT NOT NULL,
    "improvement" TEXT NOT NULL,
    "overallRating" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Evaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimerEntry" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "speechEventId" TEXT NOT NULL,
    "meetingNumber" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "targetMinMinutes" INTEGER NOT NULL,
    "targetMaxMinutes" INTEGER NOT NULL,
    "actualSeconds" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AhCounterEntry" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "speechEventId" TEXT NOT NULL,
    "meetingNumber" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "fillerCounts" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AhCounterEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpeechSlotRequest" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "projectName" TEXT,
    "note" TEXT,
    "status" "SpeechSlotRequestStatus" NOT NULL DEFAULT 'pending',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpeechSlotRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prospect" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "avatarUrl" TEXT,
    "socials" JSONB NOT NULL DEFAULT '[]',
    "bio" TEXT,
    "notes" TEXT,
    "firstVisit" TIMESTAMP(3),
    "lastVisit" TIMESTAMP(3),
    "visitCount" INTEGER NOT NULL DEFAULT 0,
    "invitedBy" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'new',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prospect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactLog" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "ContactLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitLog" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "meetingId" TEXT,
    "role" TEXT,
    "notes" TEXT,
    "origin" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "VisitLog_pkey" PRIMARY KEY ("id")
);

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
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_expiresAt_idx" ON "RefreshToken"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "RefreshToken_familyId_idx" ON "RefreshToken"("familyId");

-- CreateIndex
CREATE INDEX "Division_districtId_idx" ON "Division"("districtId");

-- CreateIndex
CREATE INDEX "Area_divisionId_idx" ON "Area"("divisionId");

-- CreateIndex
CREATE INDEX "Area_districtId_idx" ON "Area"("districtId");

-- CreateIndex
CREATE UNIQUE INDEX "Club_slug_key" ON "Club"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Club_clubNumber_key" ON "Club"("clubNumber");

-- CreateIndex
CREATE INDEX "Club_areaId_idx" ON "Club"("areaId");

-- CreateIndex
CREATE INDEX "Club_divisionId_idx" ON "Club"("divisionId");

-- CreateIndex
CREATE INDEX "Club_districtId_idx" ON "Club"("districtId");

-- CreateIndex
CREATE INDEX "Club_directoryStatus_idx" ON "Club"("directoryStatus");

-- CreateIndex
CREATE INDEX "Membership_clubId_status_idx" ON "Membership"("clubId", "status");

-- CreateIndex
CREATE INDEX "Membership_userId_idx" ON "Membership"("userId");

-- CreateIndex
CREATE INDEX "Membership_email_idx" ON "Membership"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_clubId_userId_key" ON "Membership"("clubId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_clubId_id_key" ON "Membership"("clubId", "id");

-- CreateIndex
CREATE INDEX "OrgAssignment_userId_idx" ON "OrgAssignment"("userId");

-- CreateIndex
CREATE INDEX "OrgAssignment_areaId_idx" ON "OrgAssignment"("areaId");

-- CreateIndex
CREATE INDEX "OrgAssignment_divisionId_idx" ON "OrgAssignment"("divisionId");

-- CreateIndex
CREATE INDEX "OrgAssignment_districtId_idx" ON "OrgAssignment"("districtId");

-- CreateIndex
CREATE UNIQUE INDEX "OrgAssignment_userId_role_unitType_areaId_divisionId_distri_key" ON "OrgAssignment"("userId", "role", "unitType", "areaId", "divisionId", "districtId");

-- CreateIndex
CREATE UNIQUE INDEX "Invite_tokenHash_key" ON "Invite"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "Invite_membershipId_key" ON "Invite"("membershipId");

-- CreateIndex
CREATE INDEX "Invite_clubId_status_idx" ON "Invite"("clubId", "status");

-- CreateIndex
CREATE INDEX "Invite_email_idx" ON "Invite"("email");

-- CreateIndex
CREATE INDEX "JoinRequest_clubId_status_idx" ON "JoinRequest"("clubId", "status");

-- CreateIndex
CREATE INDEX "JoinRequest_userId_idx" ON "JoinRequest"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Meeting_shareToken_key" ON "Meeting"("shareToken");

-- CreateIndex
CREATE INDEX "Meeting_clubId_dateTime_idx" ON "Meeting"("clubId", "dateTime");

-- CreateIndex
CREATE UNIQUE INDEX "Meeting_clubId_id_key" ON "Meeting"("clubId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Meeting_clubId_meetingNumber_key" ON "Meeting"("clubId", "meetingNumber");

-- CreateIndex
CREATE INDEX "HistoryEvent_clubId_membershipId_idx" ON "HistoryEvent"("clubId", "membershipId");

-- CreateIndex
CREATE INDEX "HistoryEvent_clubId_date_idx" ON "HistoryEvent"("clubId", "date");

-- CreateIndex
CREATE INDEX "Evaluation_clubId_membershipId_idx" ON "Evaluation"("clubId", "membershipId");

-- CreateIndex
CREATE INDEX "Evaluation_speechEventId_idx" ON "Evaluation"("speechEventId");

-- CreateIndex
CREATE INDEX "TimerEntry_clubId_membershipId_idx" ON "TimerEntry"("clubId", "membershipId");

-- CreateIndex
CREATE INDEX "TimerEntry_speechEventId_idx" ON "TimerEntry"("speechEventId");

-- CreateIndex
CREATE INDEX "AhCounterEntry_clubId_membershipId_idx" ON "AhCounterEntry"("clubId", "membershipId");

-- CreateIndex
CREATE INDEX "AhCounterEntry_speechEventId_idx" ON "AhCounterEntry"("speechEventId");

-- CreateIndex
CREATE INDEX "SpeechSlotRequest_clubId_membershipId_idx" ON "SpeechSlotRequest"("clubId", "membershipId");

-- CreateIndex
CREATE INDEX "SpeechSlotRequest_clubId_meetingId_idx" ON "SpeechSlotRequest"("clubId", "meetingId");

-- CreateIndex
CREATE INDEX "Prospect_clubId_stage_idx" ON "Prospect"("clubId", "stage");

-- CreateIndex
CREATE UNIQUE INDEX "Prospect_clubId_id_key" ON "Prospect"("clubId", "id");

-- CreateIndex
CREATE INDEX "ContactLog_clubId_prospectId_idx" ON "ContactLog"("clubId", "prospectId");

-- CreateIndex
CREATE INDEX "VisitLog_clubId_prospectId_idx" ON "VisitLog"("clubId", "prospectId");

-- CreateIndex
CREATE INDEX "VisitLog_meetingId_idx" ON "VisitLog"("meetingId");

-- CreateIndex
CREATE INDEX "Asset_clubId_createdAt_idx" ON "Asset"("clubId", "createdAt");

-- CreateIndex
CREATE INDEX "LibraryDocument_clubId_createdAt_idx" ON "LibraryDocument"("clubId", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryItem_clubId_createdAt_idx" ON "InventoryItem"("clubId", "createdAt");

-- CreateIndex
CREATE INDEX "ChecklistItem_clubId_meetingId_idx" ON "ChecklistItem"("clubId", "meetingId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_duesRecordId_key" ON "Transaction"("duesRecordId");

-- CreateIndex
CREATE INDEX "Transaction_clubId_date_idx" ON "Transaction"("clubId", "date");

-- CreateIndex
CREATE INDEX "Transaction_clubId_category_idx" ON "Transaction"("clubId", "category");

-- CreateIndex
CREATE INDEX "DuesRecord_clubId_periodId_idx" ON "DuesRecord"("clubId", "periodId");

-- CreateIndex
CREATE UNIQUE INDEX "DuesRecord_clubId_periodId_membershipId_key" ON "DuesRecord"("clubId", "periodId", "membershipId");

-- CreateIndex
CREATE INDEX "BudgetLine_clubId_fiscalYear_idx" ON "BudgetLine"("clubId", "fiscalYear");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetLine_clubId_fiscalYear_category_key" ON "BudgetLine"("clubId", "fiscalYear", "category");

-- CreateIndex
CREATE INDEX "Task_clubId_membershipId_idx" ON "Task"("clubId", "membershipId");

-- CreateIndex
CREATE INDEX "ActivityLog_clubId_createdAt_idx" ON "ActivityLog"("clubId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_clubId_category_idx" ON "ActivityLog"("clubId", "category");

-- CreateIndex
CREATE INDEX "ActivityLog_clubId_actorMembershipId_idx" ON "ActivityLog"("clubId", "actorMembershipId");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Division" ADD CONSTRAINT "Division_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Area" ADD CONSTRAINT "Area_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Division"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Club" ADD CONSTRAINT "Club_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgAssignment" ADD CONSTRAINT "OrgAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgAssignment" ADD CONSTRAINT "OrgAssignment_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgAssignment" ADD CONSTRAINT "OrgAssignment_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Division"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgAssignment" ADD CONSTRAINT "OrgAssignment_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JoinRequest" ADD CONSTRAINT "JoinRequest_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JoinRequest" ADD CONSTRAINT "JoinRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JoinRequest" ADD CONSTRAINT "JoinRequest_decidedByMembershipId_fkey" FOREIGN KEY ("decidedByMembershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoryEvent" ADD CONSTRAINT "HistoryEvent_clubId_membershipId_fkey" FOREIGN KEY ("clubId", "membershipId") REFERENCES "Membership"("clubId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_clubId_membershipId_fkey" FOREIGN KEY ("clubId", "membershipId") REFERENCES "Membership"("clubId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_clubId_evaluatorMembershipId_fkey" FOREIGN KEY ("clubId", "evaluatorMembershipId") REFERENCES "Membership"("clubId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimerEntry" ADD CONSTRAINT "TimerEntry_clubId_membershipId_fkey" FOREIGN KEY ("clubId", "membershipId") REFERENCES "Membership"("clubId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AhCounterEntry" ADD CONSTRAINT "AhCounterEntry_clubId_membershipId_fkey" FOREIGN KEY ("clubId", "membershipId") REFERENCES "Membership"("clubId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeechSlotRequest" ADD CONSTRAINT "SpeechSlotRequest_clubId_membershipId_fkey" FOREIGN KEY ("clubId", "membershipId") REFERENCES "Membership"("clubId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactLog" ADD CONSTRAINT "ContactLog_clubId_prospectId_fkey" FOREIGN KEY ("clubId", "prospectId") REFERENCES "Prospect"("clubId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitLog" ADD CONSTRAINT "VisitLog_clubId_prospectId_fkey" FOREIGN KEY ("clubId", "prospectId") REFERENCES "Prospect"("clubId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitLog" ADD CONSTRAINT "VisitLog_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryDocument" ADD CONSTRAINT "LibraryDocument_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_clubId_meetingId_fkey" FOREIGN KEY ("clubId", "meetingId") REFERENCES "Meeting"("clubId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_duesRecordId_fkey" FOREIGN KEY ("duesRecordId") REFERENCES "DuesRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuesRecord" ADD CONSTRAINT "DuesRecord_clubId_membershipId_fkey" FOREIGN KEY ("clubId", "membershipId") REFERENCES "Membership"("clubId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_clubId_membershipId_fkey" FOREIGN KEY ("clubId", "membershipId") REFERENCES "Membership"("clubId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- --- Raw SQL Prisma can't express ---
-- CITEXT for User.email so lookups stay case-insensitive without a
-- functional index or a shadow column.
CREATE EXTENSION IF NOT EXISTS citext;
ALTER TABLE "User" ALTER COLUMN "email" TYPE citext;

-- Partial UNIQUE indexes. Prisma UNIQUE has no WHERE clause, so a
-- double-click on the invite modal used to create two pending rows
-- for the same (clubId, email); same story on join requests.
CREATE UNIQUE INDEX invite_one_pending_per_club_email
  ON "Invite" ("clubId", lower("email"))
  WHERE status = 'pending';

CREATE UNIQUE INDEX joinreq_one_pending_per_club_user
  ON "JoinRequest" ("clubId", "userId")
  WHERE status = 'pending';
