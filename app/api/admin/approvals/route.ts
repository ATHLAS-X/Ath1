import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";
import { sql } from "@/lib/db";

async function safe<T>(p: Promise<T>, fb: T): Promise<T> {
  try { return await p; } catch { return fb; }
}

/* Unified pending-approval queue: players + academies + scouts. */
export async function GET() {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const [players, academies, scouts] = await Promise.all([
    safe(sql`
      SELECT pp.id, pp.user_id,
        COALESCE(pp.first_name || ' ' || pp.last_name, u.name, 'Player') AS name,
        pp.state, pp.submitted_at, pp.profile_status, pp.source_channel
      FROM player_profiles pp
      LEFT JOIN users u ON u.id = pp.user_id
      WHERE pp.profile_status = 'Pending Approval'
      ORDER BY pp.submitted_at ASC NULLS LAST
      LIMIT 25
    ` as unknown as Promise<any[]>, [] as any[]),
    safe(sql`
      SELECT a.id, a.user_id, a.academy_name AS name, a.state, a.submitted_at,
        (SELECT COUNT(*)::int FROM player_profiles pp WHERE pp.academy_id = a.id) AS player_count
      FROM academies a
      WHERE a.profile_status = 'Pending Approval'
      ORDER BY a.submitted_at ASC NULLS LAST
      LIMIT 25
    ` as unknown as Promise<any[]>, [] as any[]),
    safe(sql`
      SELECT u.id AS user_id, u.name, u.email, u.created_at
      FROM users u
      WHERE u.role = 'scout' AND COALESCE(u.account_status, 'pending') = 'pending'
      ORDER BY u.created_at ASC
      LIMIT 25
    ` as unknown as Promise<any[]>, [] as any[]),
  ]);

  return NextResponse.json({
    players:   (players as any[]).map((p) => ({ ...p, kind: "player" })),
    academies: (academies as any[]).map((a) => ({ ...a, kind: "academy" })),
    scouts:    (scouts as any[]).map((s) => ({ ...s, kind: "scout" })),
  });
}

/* Approve / reject / request-changes. Body: { kind, id, action, reason? } */
export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  let body: any = {};
  try { body = await req.json(); } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }
  const kind = String(body.kind ?? "");
  const id = String(body.id ?? "");
  const action = String(body.action ?? "");
  const reason = String(body.reason ?? "").trim() || null;

  if (!id || !["player", "academy", "scout"].includes(kind) ||
      !["approve", "reject", "request_changes"].includes(action)) {
    return NextResponse.json({ success: false, error: "kind, id, action required" }, { status: 400 });
  }

  if (kind === "player") {
    if (action === "approve") {
      /* Visibility: 'Scout Visible' ONLY if the latest consent row grants
         profile visibility. Otherwise stays Private even when Live. */
      const cRows = (await sql`
        SELECT pc.profile_visibility_ok
        FROM player_consents pc
        JOIN player_profiles pp ON pp.user_id = pc.user_id
        WHERE pp.id = ${id}
        ORDER BY pc.signed_at DESC
        LIMIT 1
      `) as unknown as Array<{ profile_visibility_ok: boolean }>;
      const consentOk = Boolean(cRows[0]?.profile_visibility_ok);
      await sql`
        UPDATE player_profiles
        SET profile_status = 'Live',
            visibility = ${consentOk ? "Scout Visible" : "Private"},
            updated_at = NOW()
        WHERE id = ${id}
      `;
      return NextResponse.json({ success: true, profile_status: "Live", visibility: consentOk ? "Scout Visible" : "Private", consent_ok: consentOk });
    }
    const newStatus = action === "reject" ? "Rejected" : "Changes Requested";
    await sql`
      UPDATE player_profiles
      SET profile_status = ${newStatus}, updated_at = NOW()
      WHERE id = ${id}
    `;
    return NextResponse.json({ success: true, profile_status: newStatus, reason });
  }

  if (kind === "academy") {
    if (action === "approve") {
      await sql`
        UPDATE academies
        SET profile_status = 'Live', verification_status = 'APPROVED'
        WHERE id = ${id}
      `;
      return NextResponse.json({ success: true, profile_status: "Live" });
    }
    const newStatus = action === "reject" ? "Rejected" : "Changes Requested";
    await sql`
      UPDATE academies
      SET profile_status = ${newStatus},
          verification_status = ${action === "reject" ? "REJECTED" : "PENDING"}
      WHERE id = ${id}
    `;
    return NextResponse.json({ success: true, profile_status: newStatus, reason });
  }

  /* scout — id is the user id; approval activates the account */
  if (action === "approve") {
    await sql`UPDATE users SET account_status = 'active' WHERE id = ${id} AND role = 'scout'`;
    return NextResponse.json({ success: true, account_status: "active" });
  }
  await sql`UPDATE users SET account_status = ${action === "reject" ? "suspended" : "pending"} WHERE id = ${id} AND role = 'scout'`;
  return NextResponse.json({ success: true, reason });
}
