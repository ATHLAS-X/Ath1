import { sql } from "@/lib/db";
import { ok, requireUserId } from "@/lib/onboarding-server";

export async function GET() {
  const guard = await requireUserId();
  if (guard instanceof Response) return guard;

  const rows = (await sql`
    SELECT player_role, batting_style, bowling_style, phase_specialty, dashboard_template
    FROM cricket_profile
    WHERE user_id = ${guard.userId}
    LIMIT 1
  `) as unknown as Array<{
    player_role: string | null;
    batting_style: string | null;
    bowling_style: string | null;
    phase_specialty: string | null;
    dashboard_template: string | null;
  }>;

  return ok(rows[0] ?? null);
}
