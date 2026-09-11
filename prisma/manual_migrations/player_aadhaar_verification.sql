-- CreateEnum
CREATE TYPE "athlasx"."AadhaarVerificationStatus" AS ENUM ('unverified', 'pending', 'verified');

-- AlterTable
-- Defaults preserve current behavior for every existing player_profiles row
-- (all become 'unverified', matching what every pre-existing row's absence
-- of Aadhaar data actually means) — only the self-serve player wizard sets
-- 'verified' explicitly, after src/lib/aadhaar-verification.ts's own check.
ALTER TABLE "athlasx"."player_profiles" ADD COLUMN "aadhaar_last4" TEXT,
ADD COLUMN "aadhaar_verification_status" "athlasx"."AadhaarVerificationStatus" NOT NULL DEFAULT 'unverified',
ADD COLUMN "guardian_aadhaar_last4" TEXT,
ADD COLUMN "guardian_aadhaar_verification_status" "athlasx"."AadhaarVerificationStatus" NOT NULL DEFAULT 'unverified';
