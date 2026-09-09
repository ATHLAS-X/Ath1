-- CreateEnum
CREATE TYPE "athlasx"."Gender" AS ENUM ('male', 'female', 'other');

-- CreateEnum
CREATE TYPE "athlasx"."CompetitiveLevel" AS ENUM ('club_only', 'school_team', 'zonal', 'district_team', 'state_trial', 'state_team', 'ipl_trial', 'national');

-- AlterTable
ALTER TABLE "athlasx"."player_profiles" ADD COLUMN     "batch_id" UUID,
ADD COLUMN     "batch_label" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "cricheroes_handle" TEXT,
ADD COLUMN     "enrollment_date" DATE,
ADD COLUMN     "gender" "athlasx"."Gender",
ADD COLUMN     "guardian_name" TEXT,
ADD COLUMN     "highest_level_represented" "athlasx"."CompetitiveLevel";

-- AddForeignKey
ALTER TABLE "athlasx"."player_profiles" ADD CONSTRAINT "player_profiles_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "athlasx"."academy_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
