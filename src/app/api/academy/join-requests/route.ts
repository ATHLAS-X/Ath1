import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/require-auth";
import { academyGate } from "@/lib/academy/gate";
import { getOwnedAcademy } from "@/lib/academy/scope";
import { listPendingJoinRequests } from "@/lib/academy/join-requests";

export const dynamic = "force-dynamic";

/** GET — this academy's pending join-request queue. */
export async function GET(req: NextRequest) {
  const gate = academyGate();
  if (gate) return gate;
  const auth = await requireRole(req, ["academy_admin"]);
  if (auth instanceof NextResponse) return auth;

  const academy = await getOwnedAcademy(auth.user.id);
  if (!academy) return NextResponse.json({ error: "Set up your academy first" }, { status: 400 });

  const requests = await listPendingJoinRequests(academy.id);
  return NextResponse.json({ requests });
}
