import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/require-auth";
import { academyGate } from "@/lib/academy/gate";
import { getOwnedAcademy } from "@/lib/academy/scope";
import { rejectJoinRequest } from "@/lib/academy/join-requests";

export const dynamic = "force-dynamic";

/** POST — reject a pending join request. */
export async function POST(req: NextRequest, { params }: { params: { requestId: string } }) {
  const gate = academyGate();
  if (gate) return gate;
  const auth = await requireRole(req, ["academy_admin"]);
  if (auth instanceof NextResponse) return auth;

  const academy = await getOwnedAcademy(auth.user.id);
  if (!academy) return NextResponse.json({ error: "Set up your academy first" }, { status: 400 });

  const result = await rejectJoinRequest(academy.id, params.requestId, auth.user.id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json({ ok: true });
}
