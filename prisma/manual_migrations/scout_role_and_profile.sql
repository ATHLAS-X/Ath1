-- AlterEnum
ALTER TYPE "athlasx"."UserRole" ADD VALUE 'scout';

-- CreateEnum
CREATE TYPE "athlasx"."ScoutOrgType" AS ENUM ('franchise', 'academy_recruiting_arm', 'independent');

-- CreateEnum
CREATE TYPE "athlasx"."ScoutVerificationStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "athlasx"."scout_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "org_name" TEXT NOT NULL,
    "org_type" "athlasx"."ScoutOrgType" NOT NULL,
    "contact_name" TEXT,
    "contact_phone" TEXT,
    "verification_status" "athlasx"."ScoutVerificationStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scout_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "scout_profiles_user_id_key" ON "athlasx"."scout_profiles"("user_id");

-- AddForeignKey
ALTER TABLE "athlasx"."scout_profiles" ADD CONSTRAINT "scout_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "athlasx"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
