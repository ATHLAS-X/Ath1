import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";

function err(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return err("Unauthorized", 401);

  const rows = (await sql`
    SELECT user_id FROM player_videos WHERE id = ${params.id} LIMIT 1
  `) as unknown as { user_id: string }[];

  const row = rows[0];
  if (!row) return err("Video not found", 404);
  if (row.user_id !== session.user.id) return err("Forbidden", 403);

  await sql`DELETE FROM player_videos WHERE id = ${params.id}`;
  return NextResponse.json({ success: true });
}
