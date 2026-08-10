import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";

const raw = (q: string, p: unknown[]) =>
  (sql as unknown as (q: string, p: unknown[]) => Promise<any[]>)(q, p);

async function ensureCoachTable() {
  await raw(`
    CREATE TABLE IF NOT EXISTS coach_profiles (
      id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id                   UUID UNIQUE NOT NULL,
      phone                     TEXT,
      first_name                TEXT,
      last_name                 TEXT,
      email                     TEXT,
      coaching_role             TEXT,
      specialisations           TEXT[] DEFAULT '{}',
      age_groups_coached        TEXT[] DEFAULT '{}',
      coaching_experience_years INT DEFAULT 0,
      city                      TEXT,
      state                     TEXT,
      played_state_level        BOOLEAN,
      highest_level_played      TEXT,
      playing_role              TEXT,
      highest_certification     TEXT,
      certificate_url           TEXT,
      certification_status      TEXT DEFAULT 'NONE',
      onboarding_step           INT DEFAULT 1,
      onboarding_complete       BOOLEAN DEFAULT FALSE,
      created_at                TIMESTAMPTZ DEFAULT NOW(),
      updated_at                TIMESTAMPTZ DEFAULT NOW()
    )
  `, []);
}

export async function POST(req: Request, { params }: { params: { stepNumber: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id as string;
  const stepNum = parseInt(params.stepNumber, 10);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  await ensureCoachTable();

  if (stepNum === 1) {
    await raw(`
      INSERT INTO coach_profiles (user_id, phone, first_name, last_name, email, onboarding_step, updated_at)
      VALUES ($1,$2,$3,$4,$5,2,NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        phone = EXCLUDED.phone, first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name, email = EXCLUDED.email,
        onboarding_step = GREATEST(coach_profiles.onboarding_step, 2),
        updated_at = NOW()
    `, [userId, body.phone, body.firstName, body.lastName, body.email ?? null]);
  } else if (stepNum === 2) {
    await raw(`
      INSERT INTO coach_profiles (user_id, coaching_role, specialisations, age_groups_coached,
        coaching_experience_years, city, state, played_state_level, highest_level_played,
        playing_role, onboarding_step, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,3,NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        coaching_role = EXCLUDED.coaching_role,
        specialisations = EXCLUDED.specialisations,
        age_groups_coached = EXCLUDED.age_groups_coached,
        coaching_experience_years = EXCLUDED.coaching_experience_years,
        city = EXCLUDED.city, state = EXCLUDED.state,
        played_state_level = EXCLUDED.played_state_level,
        highest_level_played = EXCLUDED.highest_level_played,
        playing_role = EXCLUDED.playing_role,
        onboarding_step = GREATEST(coach_profiles.onboarding_step, 3),
        updated_at = NOW()
    `, [
      userId, body.coachingRole,
      body.specialisations, body.ageGroupsCoached,
      body.coachingExperienceYears ?? 0,
      body.city, body.state,
      body.playedStateLevel === "Yes",
      body.highestLevelPlayed ?? null, body.playingRole ?? null,
    ]);
  } else if (stepNum === 3) {
    await raw(`
      INSERT INTO coach_profiles (user_id, highest_certification, certificate_url, certification_status, onboarding_step, updated_at)
      VALUES ($1,$2,$3,$4,4,NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        highest_certification = EXCLUDED.highest_certification,
        certificate_url = EXCLUDED.certificate_url,
        certification_status = CASE WHEN EXCLUDED.certificate_url IS NOT NULL THEN 'PENDING' ELSE 'NONE' END,
        onboarding_step = GREATEST(coach_profiles.onboarding_step, 4),
        updated_at = NOW()
    `, [
      userId, body.highestCertification,
      body.certificateUrl ?? null,
      body.certificateUrl ? "PENDING" : "NONE",
    ]);
  }

  return NextResponse.json({ success: true });
}
