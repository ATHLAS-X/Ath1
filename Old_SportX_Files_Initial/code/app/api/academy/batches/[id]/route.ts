import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";

const AGE_GROUPS = new Set(["U-10", "U-13", "U-17", "Senior", "Open"]);
const DAYS = new Set(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);

async function guardOwn(adminUserId: string, batchId: string) {
  const rows = (await sql`
    SELECT b.id FROM batches b
    JOIN academies a ON a.id = b.academy_id
    WHERE b.id = ${batchId} AND a.user_id = ${adminUserId} AND b.batch_status != 'DELETED'
    LIMIT 1
  `) as any[];
  return rows[0] ?? null;
}

/* GET — single batch with coach + player list */
export async function GET(req: Request, ctx: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "academy_admin") {
    return NextResponse.json({ success: false, error: "Academy admins only" }, { status: 403 });
  }
  const own = await guardOwn((session.user as any).id, ctx.params.id);
  if (!own) return NextResponse.json({ success: false, error: "Batch not found" }, { status: 404 });

  const [batchRows, playerRows] = await Promise.all([
    sql`
      SELECT b.id, b.batch_name, b.age_group, b.schedule_days, b.schedule_time,
             b.max_players, b.batch_status, b.created_at,
             b.coach_id, ac.coach_name, ac.specialization AS coach_specialization
      FROM batches b
      LEFT JOIN academy_coaches ac ON ac.id = b.coach_id AND ac.deleted_at IS NULL
      WHERE b.id = ${ctx.params.id}
    ` as unknown as Promise<any[]>,
    sql`
      SELECT pp.id AS player_profile_id, pp.first_name, pp.last_name,
             pp.playing_role, pp.date_of_birth, bp.joined_at
      FROM batch_players bp
      JOIN player_profiles pp ON pp.id = bp.player_profile_id
      WHERE bp.batch_id = ${ctx.params.id}
      ORDER BY pp.first_name
    ` as unknown as Promise<any[]>,
  ]);

  return NextResponse.json({ success: true, batch: { ...(batchRows as any[])[0], players: playerRows as any[] } });
}

/* PUT — edit batch fields */
export async function PUT(req: Request, ctx: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "academy_admin") {
    return NextResponse.json({ success: false, error: "Academy admins only" }, { status: 403 });
  }
  const adminUserId = (session.user as any).id as string;
  const own = await guardOwn(adminUserId, ctx.params.id);
  if (!own) return NextResponse.json({ success: false, error: "Batch not found" }, { status: 404 });

  let body: any = {};
  try { body = await req.json(); } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  if (body.age_group && !AGE_GROUPS.has(body.age_group)) {
    return NextResponse.json({ success: false, error: `age_group must be one of: ${[...AGE_GROUPS].join(", ")}` }, { status: 400 });
  }

  const scheduleDays: string[] | null = Array.isArray(body.schedule_days)
    ? body.schedule_days.map(String).filter((d: string) => DAYS.has(d))
    : null;

  await sql`
    UPDATE batches SET
      batch_name    = COALESCE(${body.batch_name ?? null}, batch_name),
      age_group     = COALESCE(${body.age_group ?? null}, age_group),
      schedule_days = COALESCE(${scheduleDays}, schedule_days),
      schedule_time = COALESCE(${body.schedule_time ?? null}, schedule_time),
      max_players   = COALESCE(${body.max_players ?? null}, max_players),
      batch_status  = COALESCE(${body.batch_status ?? null}, batch_status),
      updated_at    = NOW()
    WHERE id = ${ctx.params.id}
  `;

  return NextResponse.json({ success: true });
}

/* DELETE — soft delete (sets batch_status = DELETED, clears batch_players) */
export async function DELETE(req: Request, ctx: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "academy_admin") {
    return NextResponse.json({ success: false, error: "Academy admins only" }, { status: 403 });
  }
  const own = await guardOwn((session.user as any).id, ctx.params.id);
  if (!own) return NextResponse.json({ success: false, error: "Batch not found" }, { status: 404 });

  await sql`UPDATE batches SET batch_status = 'DELETED', updated_at = NOW() WHERE id = ${ctx.params.id}`;
  await sql`DELETE FROM batch_players WHERE batch_id = ${ctx.params.id}`;

  return NextResponse.json({ success: true });
}
