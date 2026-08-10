import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { isMinor } from "@/lib/profile-completion";

const PHONE_RE = /^\+?[0-9]{7,15}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as any).id as string;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parent_name  = String(body.parent_name ?? "").trim() || null;
  const parent_phone = String(body.parent_phone ?? "").trim() || null;
  const parent_email = String(body.parent_email ?? "").trim() || null;
  const profile_visibility_ok = Boolean(body.profile_visibility_ok);
  const media_upload_ok       = Boolean(body.media_upload_ok);
  const scout_contact_ok      = Boolean(body.scout_contact_ok);
  const data_usage_ok         = Boolean(body.data_usage_ok);

  /* Check DOB to determine if this player is a minor — required fields differ. */
  const profileRows = (await sql`
    SELECT date_of_birth FROM player_profiles WHERE user_id = ${userId} LIMIT 1
  `) as unknown as Array<{ date_of_birth: Date | null }>;
  const minor = isMinor(profileRows[0]?.date_of_birth);

  if (minor) {
    if (!parent_name) return NextResponse.json({ success: false, error: "Parent name is required for minors" }, { status: 400 });
    if (!parent_phone || !PHONE_RE.test(parent_phone))
      return NextResponse.json({ success: false, error: "Valid parent phone is required" }, { status: 400 });
    if (parent_email && !EMAIL_RE.test(parent_email))
      return NextResponse.json({ success: false, error: "Parent email is invalid" }, { status: 400 });
    if (!profile_visibility_ok || !media_upload_ok || !scout_contact_ok || !data_usage_ok) {
      return NextResponse.json(
        { success: false, error: "All four consent checkboxes are required" },
        { status: 400 },
      );
    }
  }

  await sql`
    INSERT INTO player_consents
      (user_id, parent_name, parent_phone, parent_email,
       profile_visibility_ok, media_upload_ok, scout_contact_ok, data_usage_ok,
       minor_flag, signed_at)
    VALUES
      (${userId}, ${parent_name}, ${parent_phone}, ${parent_email},
       ${profile_visibility_ok}, ${media_upload_ok}, ${scout_contact_ok}, ${data_usage_ok},
       ${minor}, NOW())
  `;

  return NextResponse.json({ success: true, minor });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as any).id as string;
  const rows = (await sql`
    SELECT parent_name, parent_phone, parent_email,
           profile_visibility_ok, media_upload_ok, scout_contact_ok, data_usage_ok,
           minor_flag, signed_at
    FROM player_consents WHERE user_id = ${userId}
    ORDER BY signed_at DESC LIMIT 1
  `) as unknown as Array<any>;
  return NextResponse.json(rows[0] ?? null);
}
