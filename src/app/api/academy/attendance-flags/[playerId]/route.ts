import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/require-auth";
import { academyGate } from "@/lib/academy/gate";
import { getOwnedAcademy } from "@/lib/academy/scope";
import {
  applyAttendanceFlagAction,
  DEFAULT_ABSENCE_THRESHOLD,
  loadAttendanceFollowUpForPlayer,
  type FlagAction,
} from "@/lib/academy/attendance-flags";

export const dynamic = "force-dynamic";

/**
 * GET  — follow-up status for one player (?consecutive_absences=&threshold=).
 *        consecutive_absences must be supplied by the caller: the
 *        batch-scoped session/attendance computation this fed from on
 *        origin/v1-features-sparsh was not part of this port (see
 *        src/lib/academy/attendance-flags.ts header comment).
 * POST — apply a dismiss/snooze/unsnooze action ({ action, duration_days? }).
 */
export async function GET(req: NextRequest, { params }: { params: { playerId: string } }) {
  const gate = academyGate();
  if (gate) return gate;
  const auth = await requireRole(req, ["academy_admin"]);
  if (auth instanceof NextResponse) return auth;

  const academy = await getOwnedAcademy(auth.user.id);
  if (!academy) return NextResponse.json({ error: "Set up your academy first" }, { status: 400 });

  const consecutive = Number(req.nextUrl.searchParams.get("consecutive_absences") ?? 0);
  const threshold = Number(req.nextUrl.searchParams.get("threshold") ?? DEFAULT_ABSENCE_THRESHOLD);

  const followUp = await loadAttendanceFollowUpForPlayer(
    academy.id,
    params.playerId,
    Number.isFinite(consecutive) ? consecutive : 0,
    Number.isFinite(threshold) ? threshold : DEFAULT_ABSENCE_THRESHOLD,
  );
  return NextResponse.json(followUp);
}

export async function POST(req: NextRequest, { params }: { params: { playerId: string } }) {
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

  const action = body?.action as FlagAction;
  if (!["dismiss", "snooze", "unsnooze"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const result = await applyAttendanceFlagAction(academy.id, params.playerId, action, body?.duration_days);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  return NextResponse.json(result);
}
