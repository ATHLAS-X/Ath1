import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";
import { sql } from "@/lib/db";

/* GET — pending verification records with evidence + submitter. */
export async function GET() {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  try {
    const rows = (await sql`
      SELECT v.id, v.verification_type, v.status, v.evidence_url, v.created_at,
             pu.name AS player_name, v.player_user_id,
             su.name AS submitted_by
      FROM verifications v
      LEFT JOIN users pu ON pu.id = v.player_user_id
      LEFT JOIN users su ON su.id = v.submitted_by_user_id
      WHERE v.status = 'Pending'
      ORDER BY v.created_at ASC
      LIMIT 50
    `) as unknown as Array<any>;
    return NextResponse.json(rows);
  } catch (e) {
    console.error("[admin/verifications]", e);
    return NextResponse.json([]);
  }
}

/* Verification type → ladder level it unlocks. */
const TYPE_LEVEL: Record<string, number> = {
  IDENTITY: 2,
  PERFORMANCE: 3,
  SCOUT: 4,
};

/* POST — approve/reject a verification. Body: { id, action, reason? }
   Approval bumps player_profiles.verification_level (never lowers it). */
export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  let body: any = {};
  try { body = await req.json(); } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }
  const id = String(body.id ?? "");
  const action = String(body.action ?? "");
  const reason = String(body.reason ?? "").trim() || null;
  if (!id || !["approve", "reject"].includes(action)) {
    return NextResponse.json({ success: false, error: "id and action required" }, { status: 400 });
  }

  const vRows = (await sql`
    SELECT id, player_user_id, verification_type, status
    FROM verifications WHERE id = ${id} LIMIT 1
  `) as unknown as Array<any>;
  const v = vRows[0];
  if (!v) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  if (v.status !== "Pending") {
    return NextResponse.json({ success: false, error: `Already ${v.status}` }, { status: 409 });
  }

  if (action === "reject") {
    await sql`
      UPDATE verifications
      SET status = 'Rejected', rejection_reason = ${reason},
          reviewed_by_user_id = ${guard.userId}, reviewed_at = NOW()
      WHERE id = ${id}
    `;
    return NextResponse.json({ success: true, status: "Rejected" });
  }

  await sql`
    UPDATE verifications
    SET status = 'Approved',
        reviewed_by_user_id = ${guard.userId}, reviewed_at = NOW()
    WHERE id = ${id}
  `;

  const level = TYPE_LEVEL[v.verification_type as string];
  if (level && v.player_user_id) {
    await sql`
      UPDATE player_profiles
      SET verification_level = GREATEST(COALESCE(verification_level, 1), ${level}),
          updated_at = NOW()
      WHERE user_id = ${v.player_user_id}
    `;
  }

  return NextResponse.json({ success: true, status: "Approved", new_level: level ?? null });
}
