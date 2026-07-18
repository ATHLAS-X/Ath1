import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";

const raw = (q: string, p: unknown[]) =>
  (sql as unknown as (q: string, p: unknown[]) => Promise<any[]>)(q, p);

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id as string;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  // Ensure tables exist
  await raw(`
    CREATE TABLE IF NOT EXISTS coach_profiles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID UNIQUE NOT NULL,
      phone TEXT, first_name TEXT, last_name TEXT, email TEXT,
      coaching_role TEXT, specialisations TEXT[] DEFAULT '{}',
      age_groups_coached TEXT[] DEFAULT '{}', coaching_experience_years INT DEFAULT 0,
      city TEXT, state TEXT, played_state_level BOOLEAN,
      highest_level_played TEXT, playing_role TEXT,
      highest_certification TEXT, certificate_url TEXT, certification_status TEXT DEFAULT 'NONE',
      onboarding_step INT DEFAULT 1, onboarding_complete BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `, []);

  await raw(`
    CREATE TABLE IF NOT EXISTS coach_academy (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      coach_profile_id UUID NOT NULL,
      academy_id UUID NOT NULL,
      status TEXT DEFAULT 'PENDING',
      invite_code TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(coach_profile_id, academy_id)
    )
  `, []);

  // Upsert coach profile as complete
  await raw(`
    INSERT INTO coach_profiles (
      user_id, first_name, last_name, email,
      coaching_role, specialisations, age_groups_coached, coaching_experience_years,
      city, state, played_state_level, highest_level_played, playing_role,
      highest_certification, certificate_url,
      certification_status, onboarding_step, onboarding_complete, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,4,TRUE,NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name,
      email = EXCLUDED.email, coaching_role = EXCLUDED.coaching_role,
      specialisations = EXCLUDED.specialisations, age_groups_coached = EXCLUDED.age_groups_coached,
      coaching_experience_years = EXCLUDED.coaching_experience_years,
      city = EXCLUDED.city, state = EXCLUDED.state,
      played_state_level = EXCLUDED.played_state_level,
      highest_level_played = EXCLUDED.highest_level_played, playing_role = EXCLUDED.playing_role,
      highest_certification = EXCLUDED.highest_certification,
      certificate_url = EXCLUDED.certificate_url,
      certification_status = EXCLUDED.certification_status,
      onboarding_step = 4, onboarding_complete = TRUE, updated_at = NOW()
  `, [
    userId,
    body.firstName ?? null, body.lastName ?? null, body.email ?? null,
    body.coachingRole ?? null, body.specialisations ?? [], body.ageGroupsCoached ?? [],
    body.coachingExperienceYears ?? 0,
    body.city ?? null, body.state ?? null,
    body.playedStateLevel === true,
    body.highestLevelPlayed ?? null, body.playingRole ?? null,
    body.highestCertification ?? null, body.certificateUrl ?? null,
    body.certificateUrl ? "PENDING" : "NONE",
  ]);

  // Get the coach_profile id
  const profileRows = await raw(`SELECT id FROM coach_profiles WHERE user_id = $1`, [userId]);
  const coachProfileId = profileRows[0]?.id;

  // If invite code was used, create CoachAcademy link
  if (coachProfileId && body.inviteAcademyId) {
    await raw(`
      INSERT INTO coach_academy (coach_profile_id, academy_id, status, invite_code, created_at)
      VALUES ($1,$2,'PENDING',$3,NOW())
      ON CONFLICT (coach_profile_id, academy_id) DO NOTHING
    `, [coachProfileId, body.inviteAcademyId, body.inviteCode ?? null]);

    // Mark invite code as used
    if (body.inviteCode) {
      await raw(`
        UPDATE academy_invite_codes SET used_by = $1 WHERE code = $2 AND used_by IS NULL
      `, [userId, body.inviteCode]).catch(() => {});
    }
  }

  return NextResponse.json({ success: true });
}
