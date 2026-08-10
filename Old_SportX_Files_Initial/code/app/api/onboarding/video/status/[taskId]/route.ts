/**
 * GET /api/onboarding/video/status/[taskId] — poll a video analysis task.
 *
 * Proxies the compute service's /api/v1/compute/video/status/{task_id} and
 * applies role-based response filtering:
 *
 *   player, coach, parent → developmental view only:
 *     - overall_assessment (kept)
 *     - technique_observations filtered to category === "strength" only
 *     - recommendations (kept)
 *     - data_quality_flags (kept)
 *     - role_specific_scores REMOVED
 *     - analysis_caveats REMOVED
 *
 *   scout, athlasx_admin, admin → full analysis (unchanged)
 *
 * This mirrors the compute service's own filter_analysis_for_player() logic
 * at Backend/AI/app/services/video_analysis.py:174-183.
 */

import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { computeGet, ComputeServiceError } from "@/lib/computeClient";

const FULL_ACCESS_ROLES = new Set(["scout", "athlasx_admin", "admin"]);

/**
 * Filter a compute service video analysis result down to the developmental
 * view that players/coaches/parents should see. Strips score breakdowns,
 * non-strength observations, and analysis caveats.
 */
function filterForPlayer(analysis: any): any {
  if (!analysis || typeof analysis !== "object") return analysis;

  const observations = Array.isArray(analysis.technique_observations)
    ? analysis.technique_observations
    : [];

  return {
    overall_assessment: analysis.overall_assessment,
    technique_observations: observations.filter(
      (o: any) => o.category === "strength",
    ),
    recommendations: analysis.recommendations ?? [],
    data_quality_flags: analysis.data_quality_flags ?? [],
  };
}

export async function GET(
  _req: Request,
  { params }: { params: { taskId: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const userId = (session.user as any).id;
  const role = (session.user as any).role ?? "player";
  const { taskId } = params;

  try {
    const status = await computeGet(
      `/api/v1/compute/video/status/${taskId}`,
      userId,
      role,
    );

    // Apply role-based filtering when the task is complete and has a result.
    if (
      (status.status === "COMPLETE" || status.status === "COMPLETED") &&
      status.result &&
      !FULL_ACCESS_ROLES.has(role)
    ) {
      status.result = filterForPlayer(status.result);
    }

    return NextResponse.json({ success: true, data: status });
  } catch (err) {
    if (err instanceof ComputeServiceError) {
      return NextResponse.json(
        { success: false, error: `Video status unavailable: ${err.message}` },
        { status: 503 },
      );
    }
    throw err;
  }
}
