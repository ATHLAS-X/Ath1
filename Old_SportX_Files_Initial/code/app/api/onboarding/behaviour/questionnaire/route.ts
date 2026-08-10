/**
 * GET /api/onboarding/behaviour/questionnaire — serve the ACSI-28 question bank.
 *
 * Proxies the compute service's GET /api/v1/compute/psych/questionnaire and
 * caches the result for 1 hour (the instrument is static — it never changes
 * during a deployment). Falls back to 503 if the compute service is down.
 */

import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { computeGet, ComputeServiceError } from "@/lib/computeClient";

// Module-level cache — survives across requests within the same cold start.
let cachedBank: any = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  // Serve from cache if fresh.
  if (cachedBank && Date.now() < cacheExpiry) {
    return NextResponse.json({ success: true, data: cachedBank });
  }

  const userId = (session.user as any).id;
  const role = (session.user as any).role ?? "player";

  try {
    const bank = await computeGet(
      "/api/v1/compute/psych/questionnaire",
      userId,
      role,
    );

    // Cache the result.
    cachedBank = bank;
    cacheExpiry = Date.now() + CACHE_TTL_MS;

    return NextResponse.json({ success: true, data: bank });
  } catch (err) {
    if (err instanceof ComputeServiceError) {
      return NextResponse.json(
        { success: false, error: `Question bank unavailable: ${err.message}` },
        { status: 503 },
      );
    }
    throw err;
  }
}
