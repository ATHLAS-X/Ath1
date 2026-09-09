import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/require-auth";
import { academyGate } from "@/lib/academy/gate";
import { getOwnedAcademy } from "@/lib/academy/scope";
import { assignPlayerToBatch, listPlayersInBatch } from "@/lib/academy/batches";

export const dynamic = "force-dynamic";

/**
 * GET  — roster of one batch.
 * POST — add a player to a batch ({ player_id }).
 */
export async function GET(req: NextRequest, { params }: { params: { batchId: string } }) {
  const gate = academyGate();
  if (gate) return gate;
  const auth = await requireRole(req, ["academy_admin"]);
  if (auth instanceof NextResponse) return auth;

  const academy = await getOwnedAcademy(auth.user.id);
  if (!academy) return NextResponse.json({ error: "Set up your academy first" }, { status: 400 });

  const result = await listPlayersInBatch(academy.id, params.batchId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 404 });

  return NextResponse.json({ players: result.players });
}

export async function POST(req: NextRequest, { params }: { params: { batchId: string } }) {
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

  const playerId = String(body?.player_id ?? "").trim();
  const result = await assignPlayerToBatch(academy.id, params.batchId, playerId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json({ added: result.added });
}
