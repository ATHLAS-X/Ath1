-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PLAYER', 'ACADEMY', 'TOURNAMENT_ORGANIZER', 'SCOUT', 'ADMIN');

-- CreateEnum
CREATE TYPE "SourceChannel" AS ENUM ('INDEPENDENT_PLAYER', 'ACADEMY', 'TOURNAMENT', 'SCOUT', 'ADMIN');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "DominantHand" AS ENUM ('RIGHT', 'LEFT', 'AMBIDEXTROUS');

-- CreateEnum
CREATE TYPE "PrimaryRole" AS ENUM ('BATTER', 'BOWLER', 'ALL_ROUNDER', 'WICKETKEEPER');

-- CreateEnum
CREATE TYPE "BattingStyle" AS ENUM ('RIGHT_HAND', 'LEFT_HAND');

-- CreateEnum
CREATE TYPE "BowlingStyle" AS ENUM ('FAST', 'MEDIUM_FAST', 'MEDIUM', 'OFF_SPIN', 'LEG_SPIN', 'LEFT_ARM_SPIN', 'LEFT_ARM_FAST', 'LEFT_ARM_ORTHODOX', 'CHINAMAN');

-- CreateEnum
CREATE TYPE "VisibilityState" AS ENUM ('HIDDEN', 'DRAFT', 'LIVE');

-- CreateEnum
CREATE TYPE "VerificationLevel" AS ENUM ('SELF_REGISTERED', 'IDENTITY_VERIFIED', 'PERFORMANCE_VERIFIED', 'SCOUT_VERIFIED');

-- CreateEnum
CREATE TYPE "VerificationType" AS ENUM ('SELF', 'IDENTITY', 'PERFORMANCE', 'SCOUT');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('VIDEO', 'PHOTO', 'SCORECARD', 'CERTIFICATE', 'AUDIO');

-- CreateEnum
CREATE TYPE "CoachStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ScoutType" AS ENUM ('INDEPENDENT', 'FRANCHISE', 'STATE', 'COUNTRY', 'ACADEMY_AFFILIATE');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "phone" TEXT,
    "email_verified_at" TIMESTAMPTZ(6),
    "phone_verified_at" TIMESTAMPTZ(6),
    "role" "UserRole" NOT NULL DEFAULT 'PLAYER',
    "source_channel" "SourceChannel" NOT NULL DEFAULT 'INDEPENDENT_PLAYER',
    "display_name" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "date_of_birth" DATE NOT NULL,
    "gender" "Gender" NOT NULL,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT NOT NULL DEFAULT 'India',
    "height_cm" DECIMAL(5,2),
    "weight_kg" DECIMAL(5,2),
    "dominant_hand" "DominantHand",
    "primary_role" "PrimaryRole",
    "secondary_role" "PrimaryRole",
    "batting_style" "BattingStyle",
    "bowling_style" "BowlingStyle",
    "wicket_keeper" BOOLEAN NOT NULL DEFAULT false,
    "school_team" TEXT,
    "club_team" TEXT,
    "district_team" TEXT,
    "state_team" TEXT,
    "academy_id" UUID,
    "player_bio" TEXT,
    "aspirations" TEXT,
    "strengths" TEXT,
    "improvement_areas" TEXT,
    "latest_yoyo_score" DECIMAL(5,2),
    "latest_30m_sprint" DECIMAL(4,2),
    "latest_2km_run" DECIMAL(6,2),
    "avg_discipline_score" DECIMAL(4,2),
    "avg_coachability_score" DECIMAL(4,2),
    "avg_work_ethic_score" DECIMAL(4,2),
    "avg_leadership_score" DECIMAL(4,2),
    "avg_mental_toughness" DECIMAL(4,2),
    "visibility" "VisibilityState" NOT NULL DEFAULT 'DRAFT',
    "verification_level" "VerificationLevel" NOT NULL DEFAULT 'SELF_REGISTERED',
    "profile_completion_pct" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "player_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_consents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "player_id" UUID NOT NULL,
    "consent_type" TEXT NOT NULL,
    "parent_name" TEXT,
    "parent_phone" TEXT,
    "parent_phone_verified" BOOLEAN NOT NULL DEFAULT false,
    "parent_email" TEXT,
    "parent_email_verified" BOOLEAN NOT NULL DEFAULT false,
    "disclaimer_signed" BOOLEAN NOT NULL DEFAULT false,
    "minor_flag" BOOLEAN NOT NULL DEFAULT false,
    "signed_at" TIMESTAMPTZ(6),
    "evidence_url" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_media" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "player_id" UUID NOT NULL,
    "media_type" "MediaType" NOT NULL,
    "url" TEXT NOT NULL,
    "youtube_video_id" TEXT,
    "title" TEXT,
    "description" TEXT,
    "uploaded_by_user_id" UUID,
    "ai_analysed" BOOLEAN NOT NULL DEFAULT false,
    "strong_points" TEXT[],
    "weak_points" TEXT[],
    "uploaded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_performance_summaries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "player_id" UUID NOT NULL,
    "format" TEXT NOT NULL,
    "matches_batted" INTEGER NOT NULL DEFAULT 0,
    "innings" INTEGER NOT NULL DEFAULT 0,
    "runs" INTEGER NOT NULL DEFAULT 0,
    "not_outs" INTEGER NOT NULL DEFAULT 0,
    "highest_score" TEXT,
    "batting_avg" DECIMAL(6,2),
    "strike_rate" DECIMAL(6,2),
    "fifties" INTEGER NOT NULL DEFAULT 0,
    "hundreds" INTEGER NOT NULL DEFAULT 0,
    "matches_bowled" INTEGER NOT NULL DEFAULT 0,
    "overs_bowled" DECIMAL(7,1),
    "wickets" INTEGER NOT NULL DEFAULT 0,
    "bowling_avg" DECIMAL(6,2),
    "economy" DECIMAL(5,2),
    "bowling_sr" DECIMAL(6,2),
    "best_figures" TEXT,
    "five_fors" INTEGER NOT NULL DEFAULT 0,
    "catches" INTEGER NOT NULL DEFAULT 0,
    "stumpings" INTEGER NOT NULL DEFAULT 0,
    "runouts" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "player_performance_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academy_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "academy_name" TEXT NOT NULL,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT NOT NULL DEFAULT 'India',
    "established_year" INTEGER,
    "head_coach_name" TEXT,
    "registration_number" TEXT,
    "affiliations" TEXT[],
    "logo_url" TEXT,
    "bio" TEXT,
    "visibility" "VisibilityState" NOT NULL DEFAULT 'DRAFT',
    "verification_status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "academy_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academy_coaches" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "academy_id" UUID NOT NULL,
    "user_id" UUID,
    "coach_name" TEXT NOT NULL,
    "role" TEXT,
    "certificate_type" TEXT,
    "certificate_url" TEXT,
    "bio" TEXT,
    "status" "CoachStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "approved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "academy_coaches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scout_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "scout_name" TEXT NOT NULL,
    "organization" TEXT,
    "scout_type" "ScoutType" NOT NULL DEFAULT 'INDEPENDENT',
    "city" TEXT,
    "state" TEXT,
    "country" TEXT NOT NULL DEFAULT 'India',
    "bio" TEXT,
    "pref_min_age" INTEGER,
    "pref_max_age" INTEGER,
    "pref_roles" "PrimaryRole"[] DEFAULT ARRAY[]::"PrimaryRole"[],
    "pref_states" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "verification_status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "subscription_status" TEXT NOT NULL DEFAULT 'inactive',
    "subscription_renews_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "scout_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scout_watchlist" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "scout_id" UUID NOT NULL,
    "player_id" UUID NOT NULL,
    "scout_rating" INTEGER,
    "potential_tag" TEXT,
    "added_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scout_watchlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scout_notes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "scout_id" UUID NOT NULL,
    "player_id" UUID NOT NULL,
    "note" TEXT NOT NULL,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "scout_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "player_id" UUID NOT NULL,
    "verification_type" "VerificationType" NOT NULL,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "evidence_url" TEXT,
    "evidence_metadata" JSONB,
    "verified_by_user_id" UUID,
    "verified_at" TIMESTAMPTZ(6),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fitness_assessments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "player_id" UUID NOT NULL,
    "recorded_by_user_id" UUID,
    "yoyo_score" DECIMAL(5,2),
    "sprint_30m_sec" DECIMAL(4,2),
    "run_2km_sec" INTEGER,
    "vertical_jump_cm" DECIMAL(5,2),
    "agility_sec" DECIMAL(4,2),
    "height_cm" DECIMAL(5,2),
    "weight_kg" DECIMAL(5,2),
    "resting_hr_bpm" INTEGER,
    "fitness_score" INTEGER,
    "notes" TEXT,
    "recorded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fitness_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "behavioral_evaluations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "player_id" UUID NOT NULL,
    "evaluator_user_id" UUID,
    "discipline" INTEGER,
    "coachability" INTEGER,
    "work_ethic" INTEGER,
    "leadership" INTEGER,
    "mental_toughness" INTEGER,
    "communication" INTEGER,
    "notes" TEXT,
    "coaching_tip" TEXT,
    "evaluated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "behavioral_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "development_milestones" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "player_id" UUID NOT NULL,
    "added_by_user_id" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "milestone_type" TEXT,
    "evidence_url" TEXT,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "development_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "player_profiles_user_id_key" ON "player_profiles"("user_id");

-- CreateIndex
CREATE INDEX "player_profiles_visibility_idx" ON "player_profiles"("visibility");

-- CreateIndex
CREATE INDEX "player_profiles_academy_id_idx" ON "player_profiles"("academy_id");

-- CreateIndex
CREATE INDEX "player_profiles_state_city_idx" ON "player_profiles"("state", "city");

-- CreateIndex
CREATE INDEX "player_profiles_primary_role_idx" ON "player_profiles"("primary_role");

-- CreateIndex
CREATE INDEX "player_consents_player_id_idx" ON "player_consents"("player_id");

-- CreateIndex
CREATE INDEX "player_media_player_id_media_type_idx" ON "player_media"("player_id", "media_type");

-- CreateIndex
CREATE INDEX "player_performance_summaries_player_id_idx" ON "player_performance_summaries"("player_id");

-- CreateIndex
CREATE UNIQUE INDEX "player_performance_summaries_player_id_format_key" ON "player_performance_summaries"("player_id", "format");

-- CreateIndex
CREATE UNIQUE INDEX "academy_profiles_user_id_key" ON "academy_profiles"("user_id");

-- CreateIndex
CREATE INDEX "academy_profiles_state_city_idx" ON "academy_profiles"("state", "city");

-- CreateIndex
CREATE INDEX "academy_profiles_verification_status_idx" ON "academy_profiles"("verification_status");

-- CreateIndex
CREATE UNIQUE INDEX "academy_coaches_user_id_key" ON "academy_coaches"("user_id");

-- CreateIndex
CREATE INDEX "academy_coaches_academy_id_idx" ON "academy_coaches"("academy_id");

-- CreateIndex
CREATE UNIQUE INDEX "scout_profiles_user_id_key" ON "scout_profiles"("user_id");

-- CreateIndex
CREATE INDEX "scout_profiles_verification_status_idx" ON "scout_profiles"("verification_status");

-- CreateIndex
CREATE INDEX "scout_profiles_state_idx" ON "scout_profiles"("state");

-- CreateIndex
CREATE INDEX "scout_watchlist_scout_id_idx" ON "scout_watchlist"("scout_id");

-- CreateIndex
CREATE INDEX "scout_watchlist_player_id_idx" ON "scout_watchlist"("player_id");

-- CreateIndex
CREATE UNIQUE INDEX "scout_watchlist_scout_id_player_id_key" ON "scout_watchlist"("scout_id", "player_id");

-- CreateIndex
CREATE INDEX "scout_notes_scout_id_player_id_idx" ON "scout_notes"("scout_id", "player_id");

-- CreateIndex
CREATE INDEX "verifications_player_id_verification_type_idx" ON "verifications"("player_id", "verification_type");

-- CreateIndex
CREATE INDEX "verifications_status_idx" ON "verifications"("status");

-- CreateIndex
CREATE INDEX "fitness_assessments_player_id_recorded_at_idx" ON "fitness_assessments"("player_id", "recorded_at");

-- CreateIndex
CREATE INDEX "behavioral_evaluations_player_id_evaluated_at_idx" ON "behavioral_evaluations"("player_id", "evaluated_at");

-- CreateIndex
CREATE INDEX "development_milestones_player_id_occurred_at_idx" ON "development_milestones"("player_id", "occurred_at");

-- AddForeignKey
ALTER TABLE "player_profiles" ADD CONSTRAINT "player_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_profiles" ADD CONSTRAINT "player_profiles_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "academy_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_consents" ADD CONSTRAINT "player_consents_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_media" ADD CONSTRAINT "player_media_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_performance_summaries" ADD CONSTRAINT "player_performance_summaries_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academy_profiles" ADD CONSTRAINT "academy_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academy_coaches" ADD CONSTRAINT "academy_coaches_academy_id_fkey" FOREIGN KEY ("academy_id") REFERENCES "academy_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academy_coaches" ADD CONSTRAINT "academy_coaches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scout_profiles" ADD CONSTRAINT "scout_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scout_watchlist" ADD CONSTRAINT "scout_watchlist_scout_id_fkey" FOREIGN KEY ("scout_id") REFERENCES "scout_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scout_watchlist" ADD CONSTRAINT "scout_watchlist_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scout_notes" ADD CONSTRAINT "scout_notes_scout_id_fkey" FOREIGN KEY ("scout_id") REFERENCES "scout_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scout_notes" ADD CONSTRAINT "scout_notes_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_verified_by_user_id_fkey" FOREIGN KEY ("verified_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fitness_assessments" ADD CONSTRAINT "fitness_assessments_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fitness_assessments" ADD CONSTRAINT "fitness_assessments_recorded_by_user_id_fkey" FOREIGN KEY ("recorded_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "behavioral_evaluations" ADD CONSTRAINT "behavioral_evaluations_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "behavioral_evaluations" ADD CONSTRAINT "behavioral_evaluations_evaluator_user_id_fkey" FOREIGN KEY ("evaluator_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "development_milestones" ADD CONSTRAINT "development_milestones_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "player_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "development_milestones" ADD CONSTRAINT "development_milestones_added_by_user_id_fkey" FOREIGN KEY ("added_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

