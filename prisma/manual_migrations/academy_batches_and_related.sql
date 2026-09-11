-- CreateEnum
CREATE TYPE "athlasx"."AcademyBatchStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "athlasx"."AcademyBatchMembershipStatus" AS ENUM ('active', 'removed');

-- CreateEnum
CREATE TYPE "athlasx"."AcademyJoinRequestStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "athlasx"."AcademyAttendanceFlagStatus" AS ENUM ('dismissed', 'snoozed');

-- AlterEnum
ALTER TYPE "athlasx"."ProfileSource" ADD VALUE 'academy_join_request';

-- AlterTable
-- Nullable, no default — an existing academy row has no admin until one is
-- assigned; the unique index below still applies once it's set.
ALTER TABLE "athlasx"."academies" ADD COLUMN "admin_user_id" UUID;

-- CreateTable
CREATE TABLE "athlasx"."academy_batches" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "academy_id" UUID NOT NULL,
    "batch_name" TEXT NOT NULL,
    "age_group" TEXT,
    "schedule_days" TEXT[],
    "schedule_time" TEXT,
    "batch_status" "athlasx"."AcademyBatchStatus" NOT NULL DEFAULT 'ACTIVE',
    "max_players" INTEGER,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "academy_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "athlasx"."academy_batch_memberships" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "batch_id" UUID NOT NULL,
    "player_id" UUID NOT NULL,
    "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "athlasx"."AcademyBatchMembershipStatus" NOT NULL DEFAULT 'active',

    CONSTRAINT "academy_batch_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "athlasx"."academy_join_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "academy_id" UUID NOT NULL,
    "candidate_name" TEXT NOT NULL,
    "candidate_phone" TEXT,
    "candidate_dob" DATE,
    "player_id" UUID,
    "status" "athlasx"."AcademyJoinRequestStatus" NOT NULL DEFAULT 'pending',
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "academy_join_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "athlasx"."academy_attendance_flags" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "academy_id" UUID NOT NULL,
    "player_id" UUID NOT NULL,
    "status" "athlasx"."AcademyAttendanceFlagStatus" NOT NULL,
    "snoozed_until" TIMESTAMPTZ(6),
    "duration_days" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "academy_attendance_flags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "academy_batches_academy_id_idx" ON "athlasx"."academy_batches"("academy_id");

-- CreateIndex
CREATE INDEX "academy_batch_memberships_player_id_idx" ON "athlasx"."academy_batch_memberships"("player_id");

-- CreateIndex
CREATE UNIQUE INDEX "academy_batch_memberships_batch_id_player_id_key" ON "athlasx"."academy_batch_memberships"("batch_id", "player_id");

-- CreateIndex
CREATE INDEX "academy_join_requests_academy_id_status_idx" ON "athlasx"."academy_join_requests"("academy_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "academy_attendance_flags_academy_id_player_id_key" ON "athlasx"."academy_attendance_flags"("academy_id", "player_id");

-- CreateIndex
CREATE UNIQUE INDEX "academies_admin_user_id_key" ON "athlasx"."academies"("admin_user_id");

-- AddForeignKey
ALTER TABLE "athlasx"."academies" ADD CONSTRAINT "academies_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "athlasx"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "athlasx"."academy_batches" ADD CONSTRAINT "academy_batches_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "athlasx"."academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "athlasx"."academy_batch_memberships" ADD CONSTRAINT "academy_batch_memberships_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "athlasx"."academy_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "athlasx"."academy_batch_memberships" ADD CONSTRAINT "academy_batch_memberships_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "athlasx"."player_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "athlasx"."academy_join_requests" ADD CONSTRAINT "academy_join_requests_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "athlasx"."academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "athlasx"."academy_join_requests" ADD CONSTRAINT "academy_join_requests_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "athlasx"."player_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "athlasx"."academy_attendance_flags" ADD CONSTRAINT "academy_attendance_flags_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "athlasx"."academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "athlasx"."academy_attendance_flags" ADD CONSTRAINT "academy_attendance_flags_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "athlasx"."player_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
