import { sql } from "@/lib/db";
import { advanceStep } from "@/lib/onboarding";
import { fail, ok, requireUserId } from "@/lib/onboarding-server";
import { calculateBPI, calculateCBR, roadmapGaps } from "@/lib/stats-math";

const FORMATS = new Set(["T20", "ODI", "List-A"]);

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function optNum(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function POST(req: Request) {
  const guard = await requireUserId();
  if (guard instanceof Response) return guard;

  let body: any;
  try { body = await req.json(); } catch { return fail("Invalid JSON"); }

  const format = String(body?.format ?? "");
  if (!FORMATS.has(format)) return fail("format must be T20, ODI, or List-A");

  const batting = {
    matches: num(body?.matches),
    innings: num(body?.innings),
    runs: num(body?.runs),
    not_outs: num(body?.not_outs),
    highest_score: num(body?.highest_score),
    fifties: num(body?.fifties),
    hundreds: num(body?.hundreds),
    powerplay_sr: optNum(body?.powerplay_sr),
    middle_avg: optNum(body?.middle_avg),
    death_sr: optNum(body?.death_sr),
  };
  const bowling = {
    overs_bowled: num(body?.overs_bowled),
    wickets: num(body?.wickets),
    economy: optNum(body?.economy),
    bowl_avg: optNum(body?.bowl_avg),
    bowl_sr: optNum(body?.bowl_sr),
    best_figures: body?.best_figures ? String(body.best_figures) : null,
  };

  const bpi = calculateBPI(batting);
  const cbr = calculateCBR(bowling);
  const gaps = roadmapGaps(bpi, cbr);
  const gapsJson = JSON.stringify(gaps);

  // Upsert by (user_id, format)
  await sql`
    INSERT INTO performance_stats
      (user_id, format, matches, innings, runs, not_outs, highest_score, fifties, hundreds,
       powerplay_sr, middle_avg, death_sr,
       overs_bowled, wickets, economy, bowl_avg, bowl_sr, best_figures,
       bpi, cbr, roadmap_gaps, updated_at)
    VALUES
      (${guard.userId}, ${format}, ${batting.matches}, ${batting.innings}, ${batting.runs},
       ${batting.not_outs}, ${batting.highest_score}, ${batting.fifties}, ${batting.hundreds},
       ${batting.powerplay_sr}, ${batting.middle_avg}, ${batting.death_sr},
       ${bowling.overs_bowled}, ${bowling.wickets}, ${bowling.economy},
       ${bowling.bowl_avg}, ${bowling.bowl_sr}, ${bowling.best_figures},
       ${bpi}, ${cbr}, ${gapsJson}::jsonb, NOW())
    ON CONFLICT (user_id, format) DO UPDATE SET
      matches = EXCLUDED.matches,
      innings = EXCLUDED.innings,
      runs = EXCLUDED.runs,
      not_outs = EXCLUDED.not_outs,
      highest_score = EXCLUDED.highest_score,
      fifties = EXCLUDED.fifties,
      hundreds = EXCLUDED.hundreds,
      powerplay_sr = EXCLUDED.powerplay_sr,
      middle_avg = EXCLUDED.middle_avg,
      death_sr = EXCLUDED.death_sr,
      overs_bowled = EXCLUDED.overs_bowled,
      wickets = EXCLUDED.wickets,
      economy = EXCLUDED.economy,
      bowl_avg = EXCLUDED.bowl_avg,
      bowl_sr = EXCLUDED.bowl_sr,
      best_figures = EXCLUDED.best_figures,
      bpi = EXCLUDED.bpi,
      cbr = EXCLUDED.cbr,
      roadmap_gaps = EXCLUDED.roadmap_gaps,
      updated_at = NOW()
  `;

  // Auto-flag rule: physically impossible stats ⇒ STAT_IMPOSSIBILITY.
  const reps = (batting.powerplay_sr ?? 0) > 0 || (batting.death_sr ?? 0) > 0
    ? Math.max(batting.powerplay_sr ?? 0, batting.death_sr ?? 0)
    : 0;
  const econ = bowling.economy ?? 0;
  if (reps > 350 || (econ > 0 && econ < 2)) {
    await sql`
      INSERT INTO fraud_flags (user_id, affected_user_id, affected_account_type, flag_type, reason, flagged_reason)
      VALUES (${guard.userId}, ${guard.userId}, 'player', 'STAT_IMPOSSIBILITY',
              ${`Implausible stats in ${format}: SR=${reps}, Economy=${econ}.`},
              ${`Implausible stats in ${format}: SR=${reps}, Economy=${econ}.`})
    `;
  }

  const state = await advanceStep(guard.userId, 5);
  return ok({ format, bpi, cbr, roadmap_gaps: gaps, onboarding: state });
}

export async function GET() {
  const guard = await requireUserId();
  if (guard instanceof Response) return guard;
  const rows = (await sql`
    SELECT format, matches, innings, runs, not_outs, highest_score, fifties, hundreds,
           powerplay_sr, middle_avg, death_sr,
           overs_bowled, wickets, economy, bowl_avg, bowl_sr, best_figures, bpi, cbr
    FROM performance_stats
    WHERE user_id = ${guard.userId}
    ORDER BY format
  `) as unknown as any[];
  return ok({ stats: rows });
}
