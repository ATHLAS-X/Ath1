import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";

const ALLOWED: Record<string, "string" | "number" | "jsonb" | "textarr"> = {
  academy_name: "string",
  description: "string",
  logo_url: "string",
  founded_year: "number",
  city: "string",
  state: "string",
  country: "string",
  contact_email: "string",
  contact_phone: "string",
  website: "string",
  social_links: "jsonb",
  age_groups: "textarr",
  facilities: "textarr",
  specialties: "textarr",
};

function coerce(v: unknown, type: string): unknown {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  if (type === "number") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  if (type === "textarr") {
    if (Array.isArray(v)) return v.map(String);
    return null;
  }
  if (type === "jsonb") {
    return typeof v === "string" ? JSON.parse(v) : v;
  }
  return String(v);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if ((session.user as any).role !== "academy_admin") {
    return NextResponse.json({ success: false, error: "Academy admins only" }, { status: 403 });
  }
  const userId = (session.user as any).id as string;
  const userName = (session.user as any).name as string;

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const updates: Array<[string, unknown]> = [];
  for (const [k, type] of Object.entries(ALLOWED)) {
    if (Object.prototype.hasOwnProperty.call(body, k)) {
      updates.push([k, coerce(body[k], type)]);
    }
  }
  if (updates.length === 0) {
    return NextResponse.json({ success: true, updated: 0 });
  }

  /* Ensure a row exists. academy_name is NOT NULL — seed from the user's name
     so the upsert always succeeds even on first call. */
  await sql`
    INSERT INTO academies (user_id, academy_name)
    VALUES (${userId}, ${userName + "'s Academy"})
    ON CONFLICT DO NOTHING
  `;

  for (const [col, val] of updates) {
    await (sql as unknown as (q: string, p: unknown[]) => Promise<unknown>)(
      `UPDATE academies SET ${col} = $1 WHERE user_id = $2`,
      [val, userId],
    );
  }

  return NextResponse.json({ success: true, updated: updates.length });
}
