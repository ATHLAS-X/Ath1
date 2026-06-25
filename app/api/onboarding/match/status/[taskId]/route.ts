/**
 * GET /api/onboarding/match/status/[taskId] — poll a scorecard OCR task.
 *
 * Proxies the compute service's /api/v1/compute/ocr/status/{task_id}.
 * No role filtering needed — the OCR result is structural data (batting rows,
 * bowling rows, match context), not a subjective assessment.
 */

import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { computeGet, ComputeServiceError } from "@/lib/computeClient";

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
      `/api/v1/compute/ocr/status/${taskId}`,
      userId,
      role,
    );
    return NextResponse.json({ success: true, data: status });
  } catch (err) {
    if (err instanceof ComputeServiceError) {
      return NextResponse.json(
        { success: false, error: `OCR status unavailable: ${err.message}` },
        { status: 503 },
      );
    }
    throw err;
  }
}
