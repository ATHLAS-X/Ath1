-- CreateEnum
CREATE TYPE "athlasx"."AssociationVerificationStatus" AS ENUM ('pending', 'approved', 'rejected');

-- AlterTable
-- Default 'approved' preserves current behavior for every association
-- created so far (all through the Ops-only path, which already IS the
-- verification step). Only the new self-serve wizard sets 'pending'
-- explicitly on create.
ALTER TABLE "athlasx"."associations" ADD COLUMN "verification_status" "athlasx"."AssociationVerificationStatus" NOT NULL DEFAULT 'approved';
