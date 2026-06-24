import { sql } from "@/lib/db";
import { fail, ok, requireUserId } from "@/lib/onboarding-server";

/**
 * Coach quick-log: POST /api/coach/fitness or /api/coach/behaviour.
 *
 * "Assigned" is the academy-roster model: a coach can act on a player only
 * if (a) the coach's own login is linked into academy_coaches.user_id (see
 * the coach_email linking added to app/api/academy/coaches/[POST|PUT]) and
 * (b) that player's player_profiles.academy_id matches the coach's academy.
 *
 * fitness  -> inserts a pending row into player_fitness_assessments
 *             (assessed_by_coach_id references academy_coaches.id — NOT
 *             users.id; confirmed via scripts/migrations/players-page.ts).
 * behaviour -> there is currently NO table for coach-attributed behavioural
 *             evaluations anywhere in the schema (only `behavioral_assessment`,
 *             which is the player's own self-submitted onboarding data with
 *             no coach/status columns at all). Writing into that table would
 *             be actively wrong, not just incomplete, so this returns 501
 *             rather than fabricating a row. Needs a real migration
 *             (e.g. a `player_behavioural_evaluations` table mirroring
 *             player_fitness_assessments) before this can do anything here.
 */

const KINDS = new Set(["fitness", "behaviour"]);

export async function POST(req: Request, ctx: { params: { kind: string } }) {
  const { kind } = ctx.params;
  if (!KINDS.has(kind)) return fail("kind must be 'fitness' or 'behaviour'", 400);

  const guard = await requireUserId();
  if (guard instanceof Response) return guard;

  const rows = (await sql`SELECT role FROM users WHERE id = ${guard.userId} LIMIT 1`) as unknown as Array<{
    role: string;
  }>;
  if (rows[0]?.role !== "coach") {
    return fail("Coach role required", 403);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON");
  }
  const playerUserId = String(body?.player_user_id ?? "").trim();
  if (!playerUserId) return fail("player_user_id is required");

  const coachRows = (await sql`
    SELECT id, academy_id, can_submit_fitness, can_submit_evaluations
    FROM academy_coaches
    WHERE user_id = ${guard.userId} AND deleted_at IS NULL
    LIMIT 1
  `) as unknown as Array<{
    id: string;
    academy_id: string;
    can_submit_fitness: boolean;
    can_submit_evaluations: boolean;
  }>;
  const coach = coachRows[0];
  if (!coach) {
    return fail(
      "Your coach login isn't linked to an academy roster yet — ask your academy admin to link your account.",
      403,
    );
  }

  const permission = kind === "fitness" ? coach.can_submit_fitness : coach.can_submit_evaluations;
  if (!permission) {
    return fail(`You don't have permission to submit ${kind} logs for this academy`, 403);
  }

  /* Player must belong to the SAME academy as the coach — 404, not 403,
     so a coach can't probe for the existence of players outside their
     academy by trying ids and reading the status code. */
  const playerRows = (await sql`
    SELECT user_id FROM player_profiles WHERE user_id = ${playerUserId} AND academy_id = ${coach.academy_id} LIMIT 1
  `) as unknown as Array<{ user_id: string }>;
  if (!playerRows[0]) {
    return fail("Player not found", 404);
  }

  if (kind === "fitness") {
    const inserted = (await sql`
      INSERT INTO player_fitness_assessments
        (user_id, assessment_date, is_supervised, assessed_by_coach_id, created_by_user_id)
      VALUES
        (${playerUserId}, CURRENT_DATE, true, ${coach.id}, ${guard.userId})
      RETURNING id
    `) as unknown as Array<{ id: string }>;
    return ok({ status: "PENDING", kind, id: inserted[0]?.id }, { status: 201 });
  }

  /* kind === "behaviour" — no schema support yet, see module doc comment. */
  return fail(
    "Behavioural quick-log isn't available yet — no coach-attributable evaluation table exists in the schema.",
    501,
  );
}
