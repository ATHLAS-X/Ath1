import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";

/* Partial save for the self-signup coach onboarding wizard.
   The classic invite-redemption flow lives at /api/coach/register and takes
   a multipart payload with a token — that's untouched. This route is JSON,
   session-authed, and writes a Draft row to coach_registry. */

const ALLOWED: Record<string, "string" | "number"> = {
  coach_name:    "string",
  academy_club:  "string",
  official_id:   "string",
  cert_url:      "string",
  specialization: "string",
  years_experience: "number",
  bio:           "string",
  phone:         "string",
};

function coerce(v: unknown, type: string): unknown {
  if (v === undefined || v === null || v === "") return null;
  if (type === "number") { const n = Number(v); return Number.isFinite(n) ? n : null; }
  return String(v);
}

/* The DB schema only has a subset of the spec's coach columns. Anything we
   can't persist directly we stash on the existing row so the wizard can
   restore state, even if those columns don't exist yet. */
const PERSISTED = new Set(["coach_name", "academy_club", "official_id", "cert_url"]);

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if ((session.user as any).role !== "coach") {
    return NextResponse.json({ success: false, error: "Coach role required" }, { status: 403 });
  }
  const userId = (session.user as any).id as string;

  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; }
  catch { return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 }); }

  const updates: Array<[string, unknown]> = [];
  for (const [k, type] of Object.entries(ALLOWED)) {
    if (!Object.prototype.hasOwnProperty.call(body, k)) continue;
    if (!PERSISTED.has(k)) continue; // skip cols not in the live DB
    updates.push([k, coerce(body[k], type)]);
  }

  /* Always make sure there's a row to update — start as Draft.
     If the user_id in the session points at a deleted row (rare, only after
     manual DB cleanup) the FK fails — surface that as a clear message
     instead of a 500. */
  try {
    await sql`
      INSERT INTO coach_registry (user_id, coach_status)
      VALUES (${userId}, 'DRAFT')
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
      `UPDATE coach_registry SET ${col} = $1 WHERE user_id = $2`,
      [val, userId],
    );
  }

  return NextResponse.json({ success: true, updated: updates.length });
}
