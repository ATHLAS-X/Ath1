import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";

const raw = (q: string, p: unknown[]) =>
  (sql as unknown as (q: string, p: unknown[]) => Promise<any[]>)(q, p);

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { code?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const code = (body.code ?? "").trim().toUpperCase();
  if (!code) return NextResponse.json({ error: "Code required" }, { status: 400 });

  // Check academy_invites table (phone-based invites from Master 37)
  const rows = await raw(`
    SELECT ai.id, ai.academy_id, a.academy_name, a.city
    FROM academy_invites ai
    JOIN academies a ON a.id = ai.academy_id
    WHERE ai.status = 'PENDING'
    LIMIT 1
  `, []).catch(() => []);

  // Also check academy_invite_codes table (code-based invites)
  const codeRows = await raw(`
    SELECT aic.id, aic.academy_id, a.academy_name, a.city
    FROM academy_invite_codes aic
    JOIN academies a ON a.id = aic.academy_id
    WHERE aic.code = $1 AND aic.used_by IS NULL AND aic.expires_at > NOW()
    LIMIT 1
  `, [code]).catch(() => []);

  if (!codeRows[0]) {
    return NextResponse.json({ error: "Code not found or expired" }, { status: 404 });
  }

  const invite = codeRows[0];
  return NextResponse.json({
    academyId: invite.academy_id,
    academyName: invite.academy_name,
    city: invite.city ?? "",
  });
}
