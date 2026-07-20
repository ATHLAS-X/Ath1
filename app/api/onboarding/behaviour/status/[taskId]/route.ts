/**
 * GET /api/onboarding/behaviour/status/[taskId] — poll a psych assessment task.
 *
 * Proxies the compute service's /api/v1/compute/psych/status/{task_id} and
 * applies 3-tier role-based response filtering:
 *
 *   PLAYER, COACH, PARENT → player_development_summary + mandatory_caveats only
 *   SCOUT                 → scout_summary + response_quality_flags + mandatory_caveats
 *   ADMIN, ATHLASX_ADMIN  → full compute response (incl. raw_gemini_narrative)
 *
 * This mirrors the compute service's filter_profile_for_role() logic at
 * Backend/AI/app/services/psychology.py:168-182.
 */

import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { computeGet, ComputeServiceError } from "@/lib/computeClient";

const ADMIN_ROLES = new Set(["athlasx_admin", "admin"]);
const SCOUT_ROLES = new Set(["scout"]);

/**
 * 3-tier filter matching the compute service's filter_profile_for_role().
 * Uses LOWERCASE role values (Next.js convention).
 */
function filterForRole(result: any, role: string): any {
  if (!result || typeof result !== "object") return result;

  const caveats = result.mandatory_caveats ?? [];

  // Admin: full response including raw_gemini_narrative
  if (ADMIN_ROLES.has(role)) {
    return result;
  }

  // Scout: scout_summary + response_quality_flags + caveats
  if (SCOUT_ROLES.has(role)) {
    return {
      scout_summary: result.scout_summary,
      response_quality_flags: result.response_quality_flags,
      mandatory_caveats: caveats,
    };
  }

  // Player/Coach/Parent (default): developmental view only
  return {
    player_development_summary: result.player_development_summary,
    mandatory_caveats: caveats,
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
      `/api/v1/compute/psych/status/${taskId}`,
      userId,
      role,
    );

    // Apply role-based filtering when the task has a result.
    if (
      (status.status === "COMPLETE" || status.status === "COMPLETED") &&
      status.result
    ) {
      status.result = filterForRole(status.result, role);
    }

    return NextResponse.json({ success: true, data: status });
  } catch (err) {
    if (err instanceof ComputeServiceError) {
      return NextResponse.json(
        { success: false, error: `Assessment status unavailable: ${err.message}` },
        { status: 503 },
      );
    }
    throw err;
  }
}
