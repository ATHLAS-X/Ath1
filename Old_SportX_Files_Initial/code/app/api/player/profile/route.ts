import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";

/* Returns the current player_profiles row + media count + consent flag,
   used by the wizard to resume mid-flow and by the dashboard. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as any).id as string;

  const [profileRows, mediaRows, consentRows, fitnessRows] = await Promise.all([
    sql`SELECT * FROM player_profiles WHERE user_id = ${userId} LIMIT 1` as unknown as Promise<any[]>,
    sql`SELECT COUNT(*)::int AS cnt FROM player_media WHERE user_id = ${userId}` as unknown as Promise<any[]>,
    sql`
      SELECT parent_name, parent_phone, parent_email,
             profile_visibility_ok, media_upload_ok, scout_contact_ok, data_usage_ok
      FROM player_consents WHERE user_id = ${userId}
      ORDER BY signed_at DESC LIMIT 1
    ` as unknown as Promise<any[]>,
    sql`
      SELECT yoyo_level AS yoyo_score, sprint_time AS sprint_30m, run_2km_time AS run_2km
      FROM fitness_data WHERE user_id = ${userId} LIMIT 1
    ` as unknown as Promise<any[]>,
  ]);

  return NextResponse.json({
    profile: (profileRows as any[])[0] ?? null,
    media_count: (mediaRows as any[])[0]?.cnt ?? 0,
    consent: (consentRows as any[])[0] ?? null,
    fitness: (fitnessRows as any[])[0] ?? null,
  });
}
