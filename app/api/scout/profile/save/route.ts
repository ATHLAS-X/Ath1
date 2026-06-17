import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";

/* Partial save for scout onboarding — accepts any subset of allowed fields.
   Column names are whitelisted so we can safely interpolate. */

const ALLOWED: Record<string, "string" | "number" | "boolean" | "text[]"> = {
  designation:          "string",
  organization_name:    "string",
  org_type:             "string",
  region:               "string",
  years_experience:     "number",
  proof_url:            "string",
  preferred_age_groups: "text[]",
  preferred_roles:      "text[]",
  preferred_regions:    "text[]",
};

const ORG_TYPES = new Set(["Independent", "Franchise", "State", "Country", "Academy"]);

function coerce(v: unknown, type: string): unknown {
  if (v === undefined || v === null || v === "") return null;
  if (type === "number") { const n = Number(v); return Number.isFinite(n) ? n : null; }
  if (type === "boolean") return Boolean(v);
  if (type === "text[]") return Array.isArray(v) ? v.map(String) : null;
  return String(v);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if ((session.user as any).role !== "scout") {
    return NextResponse.json({ success: false, error: "Scout role required" }, { status: 403 });
  }
  const userId = (session.user as any).id as string;

  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; }
  catch { return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 }); }

  if (body.org_type && !ORG_TYPES.has(String(body.org_type))) {
    return NextResponse.json({ success: false, error: "Invalid org_type" }, { status: 400 });
  }

  const updates: Array<[string, unknown]> = [];
  for (const [k, type] of Object.entries(ALLOWED)) {
    if (Object.prototype.hasOwnProperty.call(body, k)) {
      updates.push([k, coerce(body[k], type)]);
    }
  }
  if (updates.length === 0) return NextResponse.json({ success: true, updated: 0 });

  /* Upsert: create the row if missing, then UPDATE per column. Surface
     stale-session FK violations as a clear 409 instead of a 500. */
  try {
    await sql`
      INSERT INTO scout_profiles (user_id) VALUES (${userId})
      ON CONFLICT (user_id) DO NOTHING
    `;
  } catch (e: any) {
    if (String(e?.code) === "23503") {
      return NextResponse.json(
        { success: false, error: "Your session is out of date — please sign out and sign in again." },
        { status: 409 },
      );
    }
    throw e;
  }

  for (const [col, val] of updates) {
    await (sql as unknown as (q: string, p: unknown[]) => Promise<unknown>)(
      `UPDATE scout_profiles SET ${col} = $1, updated_at = NOW() WHERE user_id = $2`,
      [val, userId],
    );
  }
  return NextResponse.json({ success: true, updated: updates.length });
}
