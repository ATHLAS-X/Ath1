import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as any).id as string;

  const rows = (await sql`
    SELECT * FROM academies WHERE user_id = ${userId} LIMIT 1
  `) as unknown as Array<any>;
  return NextResponse.json(rows[0] ?? null);
}
