import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/require-auth";
import { academyGate } from "@/lib/academy/gate";
import { getOwnedAcademy } from "@/lib/academy/scope";
import { loadDashboardBatchSummary } from "@/lib/academy/batches";

export const dynamic = "force-dynamic";

/** GET — stats + batch summary for the academy-admin dashboard overview. */
export async function GET(req: NextRequest) {
  const gate = academyGate();
  if (gate) return gate;
  const auth = await requireRole(req, ["academy_admin"]);
  if (auth instanceof NextResponse) return auth;

  const academy = await getOwnedAcademy(auth.user.id);
  if (!academy) {
    return NextResponse.json({ error: "Set up your academy first" }, { status: 400 });
  }

  const summary = await loadDashboardBatchSummary(academy.id);
  return NextResponse.json({ academy: { id: academy.id, name: academy.name }, ...summary });
}
