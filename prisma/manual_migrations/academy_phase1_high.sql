-- CreateEnum
CREATE TYPE "athlasx"."AcademyType" AS ENUM ('private', 'government', 'sports_club', 'school_attached', 'ngo', 'trust');

-- CreateEnum
CREATE TYPE "athlasx"."PlayerCountRange" AS ENUM ('under_50', 'from_50_to_100', 'from_100_to_250', 'over_250');

-- CreateEnum
CREATE TYPE "athlasx"."TriState" AS ENUM ('yes', 'no', 'not_sure');

-- AlterTable
ALTER TABLE "athlasx"."academies" ADD COLUMN     "academy_type" "athlasx"."AcademyType",
ADD COLUMN     "active_player_count_range" "athlasx"."PlayerCountRange",
ADD COLUMN     "bcci_affiliated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "bcci_affiliation_id" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "contact_designation" TEXT,
ADD COLUMN     "contact_name" TEXT,
ADD COLUMN     "head_coach_name" TEXT,
ADD COLUMN     "state_assoc_affiliated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "state_assoc_names" TEXT[],
ADD COLUMN     "year_established" INTEGER;

