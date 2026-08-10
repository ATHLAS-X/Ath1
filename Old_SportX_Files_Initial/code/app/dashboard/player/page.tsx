import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { calcProfileCompletion, getVerificationLevelMeta } from "@/lib/profile-completion";
import PlayerDashboardClient from "./PlayerDashboardClient";

/* Always render server-side with fresh data. Without this, Next.js may
   serve a cached version of the dashboard after Aadhaar verify / scorecard
   submit / scout request, so the verification ladder stays one step
   behind the actual DB state. */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PlayerDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/login?from=/dashboard/player");
  if ((session.user as any).role !== "player") redirect("/dashboard");
  const userId = (session.user as any).id as string;

  const [profileRows, mediaRows, fitnessRows, coachRows, aadhaarRows, scorecardRows, scoutEndorseRows] = await Promise.all([
    sql`SELECT * FROM player_profiles WHERE user_id = ${userId} LIMIT 1` as unknown as Promise<any[]>,
    sql`SELECT COUNT(*)::int AS cnt FROM player_media WHERE user_id = ${userId}` as unknown as Promise<any[]>,
    sql`
      SELECT yoyo_level AS yoyo_score, sprint_time AS sprint_30m, run_2km_time AS run_2km
      FROM fitness_data WHERE user_id = ${userId} LIMIT 1
    ` as unknown as Promise<any[]>,
    sql`
      SELECT COUNT(*)::int AS cnt FROM coach_registry
      WHERE user_id = ${userId} AND coach_status = 'APPROVED'
    ` as unknown as Promise<any[]>,
    sql`
      SELECT age_verified FROM aadhaar_verification
      WHERE user_id = ${userId} LIMIT 1
    ` as unknown as Promise<any[]>,
    /* Verified scorecards count — 3 unlock Level 3 (Performance Verified). */
    sql`
      SELECT COUNT(*)::int AS cnt FROM match_logs
      WHERE user_id = ${userId} AND ocr_status = 'VERIFIED'
    ` as unknown as Promise<any[]>,
    /* Approved scout endorsement unlocks Level 4. A Pending row only means
       the player has requested — they don't get L4 until an admin/scout
       flips it to Approved. */
    sql`
      SELECT COUNT(*)::int AS cnt FROM verifications
      WHERE player_user_id = ${userId} AND verification_type = 'SCOUT' AND status = 'Approved'
    ` as unknown as Promise<any[]>,
  ]);

  const p = (profileRows as any[])[0] ?? null;
  const mediaCount = (mediaRows as any[])[0]?.cnt ?? 0;
  const fitness = (fitnessRows as any[])[0] ?? {};
  const coachVerified = ((coachRows as any[])[0]?.cnt ?? 0) > 0;
  const aadhaarVerified = ((aadhaarRows as any[])[0]?.age_verified) === true;
  const verifiedScorecards = (scorecardRows as any[])[0]?.cnt ?? 0;
  const scoutEndorsed = ((scoutEndorseRows as any[])[0]?.cnt ?? 0) > 0;

  if (!p) redirect("/onboarding/player");

  const completion = calcProfileCompletion({
    first_name: p.first_name,
    last_name: p.last_name,
    date_of_birth: p.date_of_birth,
    gender: p.gender,
    state: p.state,
    height_cm: p.height_cm ? Number(p.height_cm) : null,
    weight_kg: p.weight_kg ? Number(p.weight_kg) : null,
    playing_role: p.playing_role,
    batting_style: p.batting_style,
    bowling_style: p.bowling_style,
    media_count: mediaCount,
    matches_played: p.matches_played,
    runs_scored: p.runs_scored,
    wickets_taken: p.wickets_taken,
    yoyo_score: fitness.yoyo_score,
    sprint_30m: fitness.sprint_30m,
    run_2km: fitness.run_2km,
    coach_evaluation_present: coachVerified,
  });

  /* Derive effective level from real state so users whose verification_level
     column was never bumped still see the right ladder. The stored column is
     a floor — we only ratchet up.
       L2 = Identity     → Aadhaar verified
       L3 = Performance  → 3+ verified scorecards OR a coach endorsement
       L4 = Scout        → at least one approved scout verification row
     A pending scout request is NOT L4 — the player still needs an actual
     endorsement to be approved by an admin or scout. */
  const performanceVerified = verifiedScorecards >= 3 || coachVerified;
  const derivedLevel = Math.max(
    1,
    aadhaarVerified ? 2 : 1,
    performanceVerified ? 3 : 1,
    scoutEndorsed ? 4 : 1,
  );
  const effectiveLevel = Math.max(p.verification_level ?? 1, derivedLevel);
  const verification = getVerificationLevelMeta(effectiveLevel);
  const profileStatus = p.profile_status ?? "Draft";
  const accountStatus = (session.user as any).account_status ?? "pending";

  return (
    <PlayerDashboardClient
      userName={(session.user as any).name ?? "Player"}
      profileStatus={profileStatus}
      visibility={p.visibility ?? "Private"}
      accountStatus={accountStatus}
      verification={verification}
      completion={completion}
      profileId={userId}
    />
  );
}
