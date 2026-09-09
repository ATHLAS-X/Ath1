import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/require-auth";
import { academyGate } from "@/lib/academy/gate";
import { getOwnedAcademy } from "@/lib/academy/scope";
import { removePlayerFromBatch } from "@/lib/academy/batches";

export const dynamic = "force-dynamic";

/** DELETE — remove a player from a batch. */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { batchId: string; playerId: string } },
) {
  const gate = academyGate();
  if (gate) return gate;
  const auth = await requireRole(req, ["academy_admin"]);
  if (auth instanceof NextResponse) return auth;

  const academy = await getOwnedAcademy(auth.user.id);
  if (!academy) return NextResponse.json({ error: "Set up your academy first" }, { status: 400 });

  const result = await removePlayerFromBatch(academy.id, params.batchId, params.playerId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json({ ok: true });
}
