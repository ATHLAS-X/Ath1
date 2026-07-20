import { sql } from "@/lib/db";
import { advanceStep } from "@/lib/onboarding";
import { fail, ok, requireUserId, saveUpload } from "@/lib/onboarding-server";

const FORMATS = new Set(["T20", "ODI", "List-A"]);
const MQI_WEIGHTS: Record<string, number> = {
  "DCA League": 1.0,
  "Academy Cup": 0.7,
  "Corporate": 0.4,
  "Trial": 0.2,
};

// TODO: Production OCR pipeline
//   1. Push scorecard to GCS / S3.
//   2. Run Vision API or Tesseract.js to extract: opponent, format, runs, wickets,
//      strike rate, etc.
//   3. If confidence >= 0.80 → ocr_status = 'VERIFIED' (auto-award pts).
//      If confidence <  0.80 → ocr_status = 'MANUAL_REVIEW' (route to P8 review queue).
//   4. Compare OCR values against user-entered runs/wickets; flag mismatches.
//   5. On manual review approval, raise an event that re-runs the AthlasX score job.

export async function POST(req: Request) {
  const guard = await requireUserId();
  if (guard instanceof Response) return guard;

  const ct = req.headers.get("content-type") ?? "";
  if (!ct.includes("multipart/form-data")) return fail("Expected multipart/form-data");
  const form = await req.formData();

  const opponent = String(form.get("opponent") ?? "").trim();
  const matchDate = String(form.get("match_date") ?? "").trim();
  const format = String(form.get("format") ?? "").trim();
  const competitionLevel = String(form.get("competition_level") ?? "").trim();
  const mqiTag = String(form.get("mqi_tag") ?? "").trim();
  const runs = Number(form.get("runs_scored") ?? 0);
  const wickets = Number(form.get("wickets_taken") ?? 0);
  const file = form.get("scorecard") as File | null;

  if (!opponent) return fail("Opponent is required");
  if (!matchDate || isNaN(new Date(matchDate).getTime())) return fail("Valid match date is required");
  if (!FORMATS.has(format)) return fail("format must be T20, ODI, or List-A");
  const mqiWeight = MQI_WEIGHTS[mqiTag];
  if (mqiWeight == null) return fail("Unknown MQI tag");
  if (!file) return fail("Scorecard upload is required");

  const scorecardUrl = await saveUpload(guard.userId, file, "matches");

  // Scorecard goes to the player's coach for manual verification.
  // Verification pts (3) are awarded only after a coach approves — never auto-granted.
  const ocrStatus = "PENDING_COACH_REVIEW";
  const pts = 0;

  await sql`
    INSERT INTO match_logs
      (user_id, opponent, match_date, format, competition_level, mqi_tag, mqi_weight,
       runs_scored, wickets_taken, scorecard_url, ocr_status, verification_pts)
    VALUES
      (${guard.userId}, ${opponent}, ${matchDate}, ${format}, ${competitionLevel}, ${mqiTag}, ${mqiWeight},
       ${runs}, ${wickets}, ${scorecardUrl}, ${ocrStatus}, ${pts})
  `;

  // Advance step on FIRST match.
  const count = (await sql`SELECT COUNT(*)::int AS n FROM match_logs WHERE user_id = ${guard.userId}`) as unknown as Array<{ n: number }>;
  let onboarding = null;
  if ((count[0]?.n ?? 0) === 1) {
    onboarding = await advanceStep(guard.userId, 6);
  }

  return ok({
    scorecard_url: scorecardUrl,
    ocr_status: ocrStatus,
    mqi_weight: mqiWeight,
    verification_pts: pts,
    onboarding,
  });
}

export async function GET() {
  const guard = await requireUserId();
  if (guard instanceof Response) return guard;
  const rows = (await sql`
    SELECT id, opponent, match_date, format, competition_level, mqi_tag, mqi_weight,
           runs_scored, wickets_taken, scorecard_url, ocr_status, verification_pts, created_at
    FROM match_logs
    WHERE user_id = ${guard.userId}
    ORDER BY match_date DESC, created_at DESC
  `) as unknown as any[];
  return ok({ matches: rows });
}
