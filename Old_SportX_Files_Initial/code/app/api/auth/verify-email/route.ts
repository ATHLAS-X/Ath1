import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/auth/verify-email?error=missing", req.url));
  }

  const [row] = await sql`
    SELECT ev.id, ev.user_id, ev.expires_at, ev.used_at
    FROM email_verifications ev
    WHERE ev.token = ${token}
    LIMIT 1
  `;

  if (!row) {
    return NextResponse.redirect(new URL("/auth/verify-email?error=invalid", req.url));
  }
  if (row.used_at) {
    return NextResponse.redirect(new URL("/auth/verify-email?error=used", req.url));
  }
  if (new Date(row.expires_at) < new Date()) {
    return NextResponse.redirect(new URL("/auth/verify-email?error=expired", req.url));
  }

  await sql`UPDATE email_verifications SET used_at = now() WHERE id = ${row.id}`;
  await sql`UPDATE users SET account_status = 'active' WHERE id = ${row.user_id}`;

  return NextResponse.redirect(new URL("/auth/login?verified=1", req.url));
}
