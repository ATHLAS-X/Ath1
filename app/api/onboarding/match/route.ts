/**
 * POST /api/onboarding/match — submit a match log with scorecard for OCR.
 * GET  /api/onboarding/match — list the user's match logs.
 *
 * POST delegates scorecard OCR to the Backend/AI compute service
 * (POST /api/v1/compute/ocr/scorecard) via the auth bridge.
 *
 * The compute service's OcrScorecardRequest accepts exactly one of:
 *   - image_url: string   (publicly fetchable jpg/png)
 *   - image_base64: string (base64-encoded jpg/png bytes)
 *
 * Since saveUpload() writes to the local filesystem (public/uploads/), which
 * the compute service on port 8000 cannot reach, we read the saved file back
 * from disk and send it as image_base64.
 *
 * Future: Once Object Storage (R2/S3/GCS) is wired up, switch to image_url
 * and remove the readFile+base64 path.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { sql } from "@/lib/db";
import { advanceStep } from "@/lib/onboarding";
import { fail, ok, requireUserId, saveUpload } from "@/lib/onboarding-server";
import { IMAGE_OR_PDF_ALLOWLIST, UploadValidationError, readAndValidateUpload } from "@/lib/upload-validation";
import { computePost, ComputeServiceError } from "@/lib/computeClient";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

const FORMATS = new Set(["T20", "ODI", "List-A"]);
const MQI_WEIGHTS: Record<string, number> = {
  "DCA League": 1.0,
  "Academy Cup": 0.7,
  "Corporate": 0.4,
  "Trial": 0.2,
};

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

  let upload;
  try {
    upload = await readAndValidateUpload(file, MAX_BYTES, IMAGE_OR_PDF_ALLOWLIST);
  } catch (e) {
    if (e instanceof UploadValidationError) return fail(e.message);
    throw e;
  }
  const scorecardUrl = await saveUpload(guard.userId, upload, "matches");

  // ── Read file back from disk and base64-encode for compute service ─────
  // saveUpload() stores locally at public/uploads/... — the compute service
  // on port 8000 can't reach this. Read it back and send as image_base64.
  // Future: Object Storage → use image_url field instead.
  const absolutePath = path.join(process.cwd(), "public", scorecardUrl);
  const fileBuffer = await readFile(absolutePath);
  const base64String = fileBuffer.toString("base64");

  // Get session role for compute auth token.
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role ?? "player";

  // ── Submit to compute service ──────────────────────────────────────────
  let taskId: string | null = null;
  try {
    const result = await computePost(
      "/api/v1/compute/ocr/scorecard",
      { image_base64: base64String },
      guard.userId,
      role,
    );
    taskId = result.task_id ?? null;
  } catch (err) {
    if (err instanceof ComputeServiceError) {
      // Log but don't block — the match log is still saved with PENDING_REVIEW.
      console.error("[match] Compute OCR submission failed:", err.message);
    } else {
      throw err;
    }
  }

  // ── Persist match log ──────────────────────────────────────────────────
  // ocr_status is PENDING_REVIEW (not "VERIFIED") — the compute service
  // determines verification status via its review pipeline.
  const ocrStatus = "PENDING_REVIEW";
  const pts = 0; // Points awarded only after compute service verifies

  await sql`
    INSERT INTO match_logs
      (user_id, opponent, match_date, format, competition_level, mqi_tag, mqi_weight,
       runs_scored, wickets_taken, scorecard_url, ocr_status, verification_pts)
    VALUES
      (${guard.userId}, ${opponent}, ${matchDate}, ${format}, ${competitionLevel}, ${mqiTag}, ${mqiWeight},
       ${runs}, ${wickets}, ${scorecardUrl}, ${ocrStatus}, ${pts})
  `;

  // TODO(db-team): store compute_task_id here once column is added
  // TODO(db-team): store compute_status here once column is added
  // TODO(db-team): store review_status = "PENDING_REVIEW" once column is added
  // TODO(db-team): store is_stub = false once column is added

  // Advance step on FIRST match.
  const count = (await sql`SELECT COUNT(*)::int AS n FROM match_logs WHERE user_id = ${guard.userId}`) as unknown as Array<{ n: number }>;
  let onboarding = null;
  if ((count[0]?.n ?? 0) === 1) {
    onboarding = await advanceStep(guard.userId, 6);
  }

  return ok({
    scorecard_url: scorecardUrl,
    ocr_status: ocrStatus,
    task_id: taskId,
    review_status: "PENDING_REVIEW",
    mqi_weight: mqiWeight,
    verification_pts: pts,
    message: taskId
      ? "Scorecard submitted for AI verification. Check status with the task_id."
      : "Scorecard saved. AI verification will be retried automatically.",
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