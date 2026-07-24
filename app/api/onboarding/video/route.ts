/**
 * POST /api/onboarding/video — submit a YouTube clip for AI technique analysis.
 *
 * Delegates to the Backend/AI compute service (POST /api/v1/compute/video/analyze)
 * via the auth bridge. Polls the compute service for results and writes to the
 * video_analysis table for backward compatibility with the existing dashboard.
 *
 * POLLING NOTE FOR FRONTEND TEAM:
 * This handler polls the compute service for up to ~120 seconds (40 × 3s).
 * If the compute job is still running after that, the route returns HTTP 504
 * with { task_id }. The 504 response includes the task_id. Frontend MUST resume
 * polling GET /api/onboarding/video/status/{task_id} on reconnect — do NOT
 * treat 504 as a terminal failure. The analysis may complete successfully in the
 * compute service even after this handler times out. Mobile browsers
 * aggressively kill connections after 60-90s when the screen locks; the
 * task_id-based resume flow is the designed recovery path for this.
 */

import { sql } from "@/lib/db";
import { advanceStep } from "@/lib/onboarding";
import { fail, ok, requireUserId } from "@/lib/onboarding-server";
import { extractYouTubeId } from "@/lib/youtube";
import { computePost, computeGet, ComputeServiceError } from "@/lib/computeClient";

// ---------------------------------------------------------------------------
// Role mapping: Next.js playing_role → Compute service PlayerRole enum
// ---------------------------------------------------------------------------
// Compute service PlayerRole (video.py:36-47):
//   "Batsman", "Fast Bowler", "Spin Bowler", "Wicketkeeper", "All-rounder"
//
// Next.js wizard Step 4 playing_role values:
//   "Batsman", "Bowler", "All-Rounder", "WK"
//
// Next.js bowling_style values (Step 4):
//   "Fast", "Medium Fast", "Medium", "Off Spin", "Leg Spin",
//   "Left-arm Spin", "Left-arm Fast"
//
// When playing_role is "Bowler", bowling_style is REQUIRED to distinguish
// fast bowlers from spin bowlers. The compute service's video analysis uses
// completely different technique frameworks for each — seam presentation and
// trunk flexion for fast bowlers, wrist position and finger release for spin.
// Defaulting to either would produce a useless analysis.

const SPIN_STYLES = new Set(["Off Spin", "Leg Spin", "Left-arm Spin"]);

function mapPlayerRole(playingRole: string, bowlingStyle?: string): string | null {
  switch (playingRole) {
    case "Batsman":
      return "Batsman";
    case "WK":
      return "Wicketkeeper";
    case "All-Rounder":
      return "All-rounder";
    case "Bowler":
      if (!bowlingStyle) return null; // Caller must reject — see POST handler
      return SPIN_STYLES.has(bowlingStyle) ? "Spin Bowler" : "Fast Bowler";
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Wait ms milliseconds. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const POLL_INTERVAL_MS = 3000;
const POLL_MAX_ATTEMPTS = 40;

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  const guard = await requireUserId();
  if (guard instanceof Response) return guard;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON");
  }

  const url = String(body?.video_url ?? "").trim();
  const videoId = extractYouTubeId(url);
  if (!videoId) return fail("Provide a valid YouTube URL");

  // Resolve player role for the compute service.
  const playingRole = String(body?.playing_role ?? "").trim();
  const bowlingStyle = String(body?.bowling_style ?? "").trim() || undefined;

  if (!playingRole) {
    return fail("playing_role is required (Batsman, Bowler, All-Rounder, or WK)");
  }

  // When playing_role is "Bowler", bowling_style is mandatory so the compute
  // service applies the correct technique framework (fast vs spin).
  if (playingRole === "Bowler" && !bowlingStyle) {
    return fail(
      "bowling_style is required when playing_role is Bowler — the analysis " +
      "framework differs fundamentally between fast and spin bowlers.",
    );
  }

  const computePlayerRole = mapPlayerRole(playingRole, bowlingStyle);
  if (!computePlayerRole) {
    return fail(`Unrecognized playing_role: ${playingRole}`);
  }

  // Look up session role for the auth token.
  // requireUserId() already validated the session; re-read the role.
  const { getServerSession } = await import("next-auth");
  const { authOptions } = await import("@/lib/auth");
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role ?? "player";

  // Clip type defaults to "Match footage" — the wizard doesn't ask for camera angle.
  const clipType = String(body?.clip_type ?? "Match footage").trim();

  // ── Submit to compute service ──────────────────────────────────────────
  let taskId: string;
  try {
    const result = await computePost(
      "/api/v1/compute/video/analyze",
      {
        player_id: guard.userId,
        player_role: computePlayerRole,
        clips: [{ youtube_url: url, clip_type: clipType }],
        context_notes: String(body?.context_notes ?? "").slice(0, 200),
      },
      guard.userId,
      role,
    );
    taskId = result.task_id;
  } catch (err) {
    if (err instanceof ComputeServiceError) {
      return fail(`Video analysis unavailable: ${err.message}`, 503);
    }
    throw err;
  }

  // TODO(db-team): store compute_task_id here once column is added
  // await sql`UPDATE video_analysis SET compute_task_id = ${taskId} WHERE user_id = ${guard.userId}`

  // ── Poll for results ───────────────────────────────────────────────────
  // See module-level POLLING NOTE for frontend recovery guidance.
  let analysis: any = null;
  let taskStatus = "PENDING";

  for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
    await sleep(POLL_INTERVAL_MS);

    try {
      const status = await computeGet(
        `/api/v1/compute/video/status/${taskId}`,
        guard.userId,
        role,
      );
      taskStatus = status.status;

      if (taskStatus === "COMPLETE" || taskStatus === "COMPLETED") {
        analysis = status.result;
        break;
      }
      if (taskStatus === "FAILED") {
        return fail(
          status.error_message ?? "Video analysis failed in the compute service",
          422,
        );
      }
      // PENDING or PROCESSING — keep polling
    } catch (err) {
      if (err instanceof ComputeServiceError) {
        // Transient error during polling — keep trying
        continue;
      }
      throw err;
    }
  }

  // Timed out — return 504 with task_id for frontend resume.
  // IMPORTANT: The frontend MUST resume polling /api/onboarding/video/status/{task_id}
  // on reconnect. Do NOT treat 504 as a terminal failure. The compute job may still
  // be running and will complete successfully — the result can be retrieved via the
  // status endpoint using the task_id returned here.
  if (!analysis) {
    return fail(
      "Analysis is still processing. Use the task_id to check status.",
      504,
    );
  }

  // ── Write to video_analysis table (backward compat) ────────────────────
  // The existing dashboard reads from this table. Extract fields from the
  // compute service's VideoAnalysisResult schema.
  const observations = Array.isArray(analysis.technique_observations)
    ? analysis.technique_observations
    : [];
  const strengths = observations
    .filter((o: any) => o.category === "strength")
    .map((o: any) => o.observation)
    .slice(0, 6);
  const weaknesses = observations
    .filter((o: any) => o.category === "development_area")
    .map((o: any) => o.observation)
    .slice(0, 6);

  const overallSummary = analysis.overall_assessment?.summary ?? "Analysis complete";
  const clipMeta = analysis.clip_metadata ?? {};

  await sql`DELETE FROM video_analysis WHERE user_id = ${guard.userId}`;
  await sql`
    INSERT INTO video_analysis
      (user_id, video_url, youtube_video_id, batting_style, wrist_movement, foot_work, bowling_action,
       strong_points, weak_points, style_classification, technique_notes, video_analysed)
    VALUES
      (${guard.userId}, ${url}, ${videoId},
       ${clipMeta.player_role ?? computePlayerRole},
       ${"See full analysis"},
       ${"See full analysis"},
       ${playingRole === "Bowler" ? (bowlingStyle ?? "See full analysis") : "N/A"},
       ${strengths}, ${weaknesses},
       ${overallSummary.slice(0, 200)},
       ${overallSummary},
       true)
  `;

  // TODO(db-team): store compute_task_id here once column is added
  // TODO(db-team): store compute_status here once column is added

  const state = await advanceStep(guard.userId, 9);

  // ── Return player-filtered result ──────────────────────────────────────
  // Players see developmental view only (strengths + recommendations).
  // The status proxy applies the same filter — see video/status/[taskId]/route.ts.
  const playerView = {
    overall_assessment: analysis.overall_assessment,
    technique_observations: strengths.map((s: string) => ({ observation: s, category: "strength" })),
    recommendations: analysis.recommendations ?? [],
    data_quality_flags: analysis.data_quality_flags ?? [],
  };

  return ok({
    task_id: taskId,
    youtube_video_id: videoId,
    analysis: playerView,
    onboarding: state,
  });
}