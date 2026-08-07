-- CreateEnum
CREATE TYPE "MemberType" AS ENUM ('new', 'existing');

-- AlterTable
ALTER TABLE "Membership" ADD COLUMN     "memberType" "MemberType";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "tiMemberNumber" TEXT;
