import { sql } from "@/lib/db";
import { advanceStep } from "@/lib/onboarding";
import { fail, ok, requireUserId } from "@/lib/onboarding-server";

const ROLES = new Set(["Batsman", "Bowler", "All-Rounder", "Wicket-Keeper"]);
const BATTING = new Set(["Right", "Left"]);
const BOWLING = new Set([
  "Right-arm Fast",
  "Left-arm Pace",
  "Off-spin",
  "Leg-spin",
  "Chinaman",
  "Does Not Bowl",
]);
const PHASES = new Set([
  "Powerplay Opener",
  "Middle-Order Anchor",
  "Death Finisher",
  "Death Bowler",
  "Spinner",
]);

/** Returns score weights driven by player role. Used by performance scoring later. */
function weightsForRole(role: string) {
  switch (role) {
    case "Batsman":
      return { bpi: 0.60, cbr: 0.00, batting: 0.30, keeping: 0.00, bowling: 0.10 };
    case "Bowler":
      return { bpi: 0.00, cbr: 0.60, batting: 0.10, keeping: 0.00, bowling: 0.30 };
    case "All-Rounder":
      return { bpi: 0.35, cbr: 0.35, batting: 0.15, keeping: 0.00, bowling: 0.15 };
    case "Wicket-Keeper":
      return { bpi: 0.30, cbr: 0.00, batting: 0.40, keeping: 0.30, bowling: 0.00 };
    default:
      return { bpi: 0.25, cbr: 0.25, batting: 0.25, keeping: 0.0, bowling: 0.25 };
  }
}

function dashboardTemplateFor(role: string) {
  switch (role) {
    case "Batsman": return "batsman";
    case "Bowler": return "bowler";
    case "All-Rounder": return "allrounder";
    case "Wicket-Keeper": return "wicketkeeper";
    default: return "default";
  }
}

export async function POST(req: Request) {
  const guard = await requireUserId();
  if (guard instanceof Response) return guard;

  let body: any;
  try { body = await req.json(); } catch { return fail("Invalid JSON"); }

  const role = String(body?.player_role ?? "");
  const batting = String(body?.batting_style ?? "");
  const bowling = String(body?.bowling_style ?? "");
  const phasesIn: unknown = body?.phase_specialty;
  const phases: string[] = Array.isArray(phasesIn) ? phasesIn.map(String) : [];

  if (!ROLES.has(role)) return fail("player_role is required");
  if (!BATTING.has(batting)) return fail("batting_style must be Right or Left");
  if (!BOWLING.has(bowling)) return fail("bowling_style is invalid");
  for (const p of phases) if (!PHASES.has(p)) return fail(`phase_specialty contains invalid value: ${p}`);

  const phaseStr = phases.join(", ").slice(0, 50);
  const template = dashboardTemplateFor(role);

  // Upsert cricket_profile by user.
  await sql`DELETE FROM cricket_profile WHERE user_id = ${guard.userId}`;
  await sql`
    INSERT INTO cricket_profile
      (user_id, player_role, batting_style, bowling_style, phase_specialty, dashboard_template, updated_at)
    VALUES
      (${guard.userId}, ${role}, ${batting}, ${bowling}, ${phaseStr}, ${template}, NOW())
  `;

  // Persist score weights JSON on player_profiles (lazy upsert).
  const weights = weightsForRole(role);
  const weightsJson = JSON.stringify(weights);
  const existing = (await sql`SELECT id FROM player_profiles WHERE user_id = ${guard.userId} LIMIT 1`) as unknown as Array<{ id: string }>;
  if (existing.length) {
    await sql`UPDATE player_profiles SET score_weights = ${weightsJson}::jsonb, updated_at = NOW() WHERE user_id = ${guard.userId}`;
  } else {
    await sql`
      INSERT INTO player_profiles (user_id, playing_role, batting_style, bowling_style, score_weights)
      VALUES (${guard.userId}, ${role}, ${batting}, ${bowling}, ${weightsJson}::jsonb)
    `;
  }

  const state = await advanceStep(guard.userId, 4);
  return ok({
    player_role: role,
    batting_style: batting,
    bowling_style: bowling,
    phase_specialty: phases,
    dashboard_template: template,
    score_weights: weights,
    onboarding: state,
  });
}
