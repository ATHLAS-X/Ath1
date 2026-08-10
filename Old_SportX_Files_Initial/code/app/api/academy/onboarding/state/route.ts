import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";

/* Resume state for the post-registration academy wizard.
   Surface counts so the final-step summary card has fresh numbers. */

async function getState(adminUserId: string) {
  const aRows = (await sql`
    SELECT id, academy_name, logo_url, profile_status,
           COALESCE(onboarding_step, 1) AS onboarding_step,
           onboarding_completed_at
    FROM academies WHERE user_id = ${adminUserId} LIMIT 1
  `) as any[];
  const a = aRows[0];
  if (!a) return null;

  const [coaches, players] = await Promise.all([
    sql`SELECT COUNT(*)::int AS n FROM academy_coaches WHERE academy_id = ${a.id}` as unknown as Promise<any[]>,
    sql`SELECT COUNT(*)::int AS n FROM player_profiles WHERE academy_id = ${a.id} AND source_channel = 'Academy'` as unknown as Promise<any[]>,
  ]);

  return {
    academy_id: a.id,
    academy_name: a.academy_name,
    logo_url: a.logo_url,
    profile_status: a.profile_status,
    onboarding_step: a.onboarding_step ?? 1,
    onboarding_completed: Boolean(a.onboarding_completed_at),
    coach_count: coaches[0]?.n ?? 0,
    player_count: players[0]?.n ?? 0,
  };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "academy_admin") {
    return NextResponse.json({ success: false, error: "Academy admin only" }, { status: 403 });
  }
  const state = await getState((session.user as any).id);
  if (!state) return NextResponse.json({ success: false, error: "No academy profile" }, { status: 404 });
  return NextResponse.json({ success: true, data: state });
}

/* POST { step } — persist the wizard cursor. */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "academy_admin") {
    return NextResponse.json({ success: false, error: "Academy admin only" }, { status: 403 });
  }

  let body: any = {};
  try { body = await req.json(); } catch {}
  const step = Math.max(1, Math.min(4, Number(body.step) || 1));
  const userId = (session.user as any).id;

  await sql`UPDATE academies SET onboarding_step = ${step} WHERE user_id = ${userId}`;
  return NextResponse.json({ success: true, step });
}
