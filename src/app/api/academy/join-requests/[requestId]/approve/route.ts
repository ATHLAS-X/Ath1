import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/require-auth";
import { academyGate } from "@/lib/academy/gate";
import { getOwnedAcademy } from "@/lib/academy/scope";
import { approveJoinRequest } from "@/lib/academy/join-requests";

export const dynamic = "force-dynamic";

/** POST — approve a pending join request into a batch ({ batch_id }). */
export async function POST(req: NextRequest, { params }: { params: { requestId: string } }) {
  const gate = academyGate();
  if (gate) return gate;
  const auth = await requireRole(req, ["academy_admin"]);
  if (auth instanceof NextResponse) return auth;

  const academy = await getOwnedAcademy(auth.user.id);
  if (!academy) return NextResponse.json({ error: "Set up your academy first" }, { status: 400 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const batchId = String(body?.batch_id ?? "").trim();
  if (!batchId) return NextResponse.json({ error: "batch_id is required" }, { status: 400 });

  const result = await approveJoinRequest(academy.id, params.requestId, batchId, auth.user.id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json({ player_id: result.player_id });
}
