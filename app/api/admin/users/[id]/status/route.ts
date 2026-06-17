import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";
import { sql } from "@/lib/db";
import { ACCOUNT_STATUSES, type AccountStatus } from "@/lib/auth";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  let body: { status?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }
  const status = body.status?.trim().toLowerCase() as AccountStatus | undefined;
  if (!status || !ACCOUNT_STATUSES.includes(status)) {
    return NextResponse.json(
      { success: false, error: `status must be one of: ${ACCOUNT_STATUSES.join(", ")}` },
      { status: 400 },
    );
  }

  await sql`
    UPDATE users SET account_status = ${status} WHERE id = ${params.id}
  `;
  return NextResponse.json({ success: true, account_status: status });
}
