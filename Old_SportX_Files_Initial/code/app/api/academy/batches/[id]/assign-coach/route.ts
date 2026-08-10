import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";

/* POST — assign or unassign a coach to a batch.
   Body: { coach_id: string | null }
   Pass null to remove the coach from the batch. */
export async function POST(req: Request, ctx: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "academy_admin") {
    return NextResponse.json({ success: false, error: "Academy admins only" }, { status: 403 });
  }
  const adminUserId = (session.user as any).id as string;

  const batchRows = (await sql`
    SELECT b.id, a.id AS academy_id FROM batches b
    JOIN academies a ON a.id = b.academy_id
    WHERE b.id = ${ctx.params.id} AND a.user_id = ${adminUserId} AND b.batch_status != 'DELETED'
    LIMIT 1
  `) as any[];
  if (!batchRows[0]) return NextResponse.json({ success: false, error: "Batch not found" }, { status: 404 });

  let body: any = {};
  try { body = await req.json(); } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const coachId = body.coach_id ? String(body.coach_id).trim() : null;

  if (coachId) {
    const coachRows = (await sql`
      SELECT id FROM academy_coaches
      WHERE id = ${coachId} AND academy_id = ${batchRows[0].academy_id} AND deleted_at IS NULL
    `) as any[];
    if (!coachRows[0]) return NextResponse.json({ success: false, error: "Coach not found in this academy" }, { status: 404 });
  }

  await sql`UPDATE batches SET coach_id = ${coachId}, updated_at = NOW() WHERE id = ${ctx.params.id}`;

  return NextResponse.json({ success: true, coach_id: coachId });
}
