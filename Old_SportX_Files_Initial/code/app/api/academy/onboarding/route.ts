import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";

/* Run once to add new wizard columns — idempotent due to IF NOT EXISTS. */
async function ensureColumns() {
  const alters = [
    "ALTER TABLE academies ADD COLUMN IF NOT EXISTS district TEXT",
    "ALTER TABLE academies ADD COLUMN IF NOT EXISTS academy_type TEXT",
    "ALTER TABLE academies ADD COLUMN IF NOT EXISTS primary_contact_name TEXT",
    "ALTER TABLE academies ADD COLUMN IF NOT EXISTS primary_contact_designation TEXT",
    "ALTER TABLE academies ADD COLUMN IF NOT EXISTS primary_contact_phone TEXT",
    "ALTER TABLE academies ADD COLUMN IF NOT EXISTS ground_type TEXT",
    "ALTER TABLE academies ADD COLUMN IF NOT EXISTS practice_nets INTEGER",
    "ALTER TABLE academies ADD COLUMN IF NOT EXISTS bowling_machine BOOLEAN DEFAULT FALSE",
    "ALTER TABLE academies ADD COLUMN IF NOT EXISTS indoor_facility BOOLEAN DEFAULT FALSE",
    "ALTER TABLE academies ADD COLUMN IF NOT EXISTS approx_capacity INTEGER",
    "ALTER TABLE academies ADD COLUMN IF NOT EXISTS head_coach_certification TEXT",
    "ALTER TABLE academies ADD COLUMN IF NOT EXISTS head_coach_experience_years INTEGER",
    "ALTER TABLE academies ADD COLUMN IF NOT EXISTS ex_pro_on_staff BOOLEAN DEFAULT FALSE",
    "ALTER TABLE academies ADD COLUMN IF NOT EXISTS ex_pro_name TEXT",
    "ALTER TABLE academies ADD COLUMN IF NOT EXISTS ex_pro_level TEXT",
    "ALTER TABLE academies ADD COLUMN IF NOT EXISTS num_assistant_coaches INTEGER",
    "ALTER TABLE academies ADD COLUMN IF NOT EXISTS age_groups_offered TEXT[]",
    "ALTER TABLE academies ADD COLUMN IF NOT EXISTS formats_trained_in TEXT[]",
    "ALTER TABLE academies ADD COLUMN IF NOT EXISTS batch_timings TEXT",
    "ALTER TABLE academies ADD COLUMN IF NOT EXISTS monthly_fee_range TEXT",
    "ALTER TABLE academies ADD COLUMN IF NOT EXISTS bcci_affiliated BOOLEAN DEFAULT FALSE",
    "ALTER TABLE academies ADD COLUMN IF NOT EXISTS bcci_affiliation_id TEXT",
    "ALTER TABLE academies ADD COLUMN IF NOT EXISTS state_association_affiliated BOOLEAN DEFAULT FALSE",
    "ALTER TABLE academies ADD COLUMN IF NOT EXISTS state_association_name TEXT",
  ];
  for (const ddl of alters) {
    try {
      await (sql as unknown as (q: string, p: unknown[]) => Promise<unknown>)(ddl, []);
    } catch {}
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "academy_admin") return NextResponse.json({ error: "Academy admin only" }, { status: 403 });

  const userId = (session.user as any).id as string;
  const userName = ((session.user as any).name ?? "Academy Admin") as string;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  await ensureColumns();

  /* Upsert academy row */
  await (sql as unknown as (q: string, p: unknown[]) => Promise<unknown>)(
    `INSERT INTO academies (user_id, academy_name) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [userId, body.academy_name ?? userName + "'s Academy"],
  );

  const raw = (q: string, p: unknown[]) =>
    (sql as unknown as (q: string, p: unknown[]) => Promise<unknown>)(q, p);

  const str = (v: unknown) => (v == null || v === "" ? null : String(v));
  const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
  const bool = (v: unknown) => Boolean(v);
  const arr = (v: unknown) => (Array.isArray(v) ? v.map(String) : null);

  const fields: Array<[string, unknown]> = [
    ["academy_name",                    str(body.academy_name)],
    ["city",                            str(body.city)],
    ["district",                        str(body.district)],
    ["state",                           str(body.state)],
    ["website",                         str(body.website)],
    ["founded_year",                    num(body.established_year)],
    ["logo_url",                        str(body.logo_url)],
    ["academy_type",                    str(body.academy_type)],
    ["primary_contact_name",            str(body.primary_contact_name)],
    ["primary_contact_designation",     str(body.primary_contact_designation)],
    ["primary_contact_phone",           str(body.phone)],
    ["ground_type",                     str(body.ground_type)],
    ["practice_nets",                   num(body.practice_nets)],
    ["bowling_machine",                 bool(body.bowling_machine)],
    ["indoor_facility",                 bool(body.indoor_facility)],
    ["approx_capacity",                 num(body.approx_capacity)],
    ["head_coach_name",                 str(body.head_coach_name)],
    ["head_coach_certification",        str(body.head_coach_certification)],
    ["head_coach_experience_years",     num(body.head_coach_experience_years)],
    ["ex_pro_on_staff",                 bool(body.ex_pro_on_staff)],
    ["ex_pro_name",                     str(body.ex_pro_name)],
    ["ex_pro_level",                    str(body.ex_pro_level)],
    ["num_assistant_coaches",           num(body.num_assistant_coaches)],
    ["age_groups_offered",              arr(body.age_groups_offered)],
    ["formats_trained_in",              arr(body.formats_trained_in)],
    ["batch_timings",                   str(body.batch_timings)],
    ["monthly_fee_range",               str(body.monthly_fee_range)],
    ["bcci_affiliated",                 bool(body.bcci_affiliated)],
    ["bcci_affiliation_id",             str(body.bcci_affiliation_id)],
    ["state_association_affiliated",    bool(body.state_association_affiliated)],
    ["state_association_name",          str(body.state_association_name)],
  ];

  for (const [col, val] of fields) {
    try {
      await raw(`UPDATE academies SET ${col} = $1 WHERE user_id = $2`, [val, userId]);
    } catch {}
  }

  /* Mark onboarding done */
  try {
    await raw(
      `UPDATE academies SET profile_status = 'Pending Approval', onboarding_completed_at = NOW() WHERE user_id = $1`,
      [userId],
    );
    await raw(
      `UPDATE users SET account_status = 'active' WHERE id = $1 AND COALESCE(account_status,'pending') = 'pending'`,
      [userId],
    );
  } catch {}

  return NextResponse.json({ success: true });
}
