import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/require-auth";
import { academyGate } from "@/lib/academy/gate";
import { getOwnedAcademy } from "@/lib/academy/scope";
import { db } from "@/lib/db";
import {
  mapBatchRow,
  mapBatchStatusToDb,
  parseAgeGroup,
  parseSchedule,
  playerCountsByBatch,
  scheduleToDbFields,
} from "@/lib/academy/batches";

export const dynamic = "force-dynamic";

/**
 * GET  — list this academy's active batches with roster counts.
 * POST — create a batch (name, optional age group, schedule).
 *
 * Ported from origin/v1-features-sparsh's app/api/academy/batches/route.ts.
 * Auth pattern copied from src/app/api/coach/squad/route.ts's requireAuth
 * convention (requireRole here, since only academy_admin may touch these
 * routes) rather than sparsh's bespoke getServerSession + role-string check.
 */
export async function GET(req: NextRequest) {
  const gate = academyGate();
  if (gate) return gate;
  const auth = await requireRole(req, ["academy_admin"]);
  if (auth instanceof NextResponse) return auth;

  const academy = await getOwnedAcademy(auth.user.id);
  if (!academy) {
    return NextResponse.json({ error: "Set up your academy first" }, { status: 400 });
  }

  const batches = await db.academyBatch.findMany({
    where: { academy_id: academy.id, batch_status: "ACTIVE" },
    orderBy: { created_at: "desc" },
  });
  const counts = await playerCountsByBatch(academy.id);

  return NextResponse.json({
    batches: batches.map((b) => mapBatchRow(b, counts.get(b.id) ?? 0)),
  });
}

export async function POST(req: NextRequest) {
  const gate = academyGate();
  if (gate) return gate;
  const auth = await requireRole(req, ["academy_admin"]);
  if (auth instanceof NextResponse) return auth;

  const academy = await getOwnedAcademy(auth.user.id);
  if (!academy) {
    return NextResponse.json({ error: "Set up your academy first" }, { status: 400 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = String(body?.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const ageGroup = body?.age_group !== undefined ? parseAgeGroup(body.age_group) : null;
  if (body?.age_group !== undefined && ageGroup === null) {
    return NextResponse.json({ error: "Invalid age_group" }, { status: 400 });
  }

  const scheduleResult = parseSchedule(body?.schedule);
  if (!scheduleResult.ok) {
    return NextResponse.json({ error: scheduleResult.error }, { status: 400 });
  }
  const { schedule_days, schedule_time } = scheduleToDbFields(scheduleResult.value);

  const maxPlayers =
    body?.max_players === undefined || body?.max_players === null
      ? null
      : Number(body.max_players);
  if (maxPlayers !== null && (!Number.isInteger(maxPlayers) || maxPlayers < 1)) {
    return NextResponse.json({ error: "max_players must be a positive integer" }, { status: 400 });
  }

  const batch = await db.academyBatch.create({
    data: {
      academy_id: academy.id,
      batch_name: name,
      age_group: ageGroup,
      schedule_days,
      schedule_time,
      max_players: maxPlayers,
      batch_status: mapBatchStatusToDb("active"),
      created_by_user_id: auth.user.id,
    },
  });

  return NextResponse.json({ batch: mapBatchRow(batch, 0) }, { status: 201 });
}
