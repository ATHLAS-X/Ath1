import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@/lib/db";
import { parseCsv, normaliseHeader } from "@/lib/csv";
import { sendEmail } from "@/lib/email";
import { sendSms } from "@/lib/sms";

/* Header aliases — accept reasonable variations from common spreadsheet exports. */
const HEADER_ALIASES: Record<string, string[]> = {
  first_name:    ["firstname", "first", "givenname"],
  last_name:     ["lastname", "last", "surname", "familyname"],
  name:          ["name", "fullname", "playername"],
  date_of_birth: ["dob", "dateofbirth", "birthdate", "birthday"],
  gender:        ["gender", "sex"],
  playing_role:  ["role", "playingrole", "primaryrole"],
  batting_style: ["battingstyle", "batting"],
  bowling_style: ["bowlingstyle", "bowling"],
  height_cm:     ["height", "heightcm"],
  weight_kg:     ["weight", "weightkg"],
  city:          ["city", "town"],
  state:         ["state", "province"],
  email:         ["email", "emailaddress"],
  phone:         ["phone", "mobile", "phonenumber"],
};

function resolveHeader(raw: string): string | null {
  const n = normaliseHeader(raw);
  for (const [canonical, aliases] of Object.entries(HEADER_ALIASES)) {
    if (n === canonical.replace(/_/g, "") || aliases.includes(n)) return canonical;
  }
  return null;
}

function splitFullName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] };
}

function parseDate(s: string): string | null {
  if (!s) return null;
  /* Accept DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, ISO. */
  const m = s.trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) {
    const [, dd, mm, yyyy] = m;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

interface InviteResult {
  row_index: number;
  status: "created" | "skipped" | "error";
  name?: string;
  email?: string | null;
  error?: string;
  player_profile_id?: string;
  invite_token?: string;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if ((session.user as any).role !== "academy_admin") {
    return NextResponse.json({ success: false, error: "Academy admins only" }, { status: 403 });
  }
  const adminId = (session.user as any).id as string;

  let body: { csv?: string; dry_run?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }
  const csv = (body.csv ?? "").trim();
  if (!csv) return NextResponse.json({ success: false, error: "CSV required" }, { status: 400 });

  /* Locate the academy_id for this admin. */
  const aRows = (await sql`
    SELECT id, academy_name, profile_status
    FROM academies WHERE user_id = ${adminId} LIMIT 1
  `) as unknown as Array<{ id: string; academy_name: string; profile_status: string | null }>;
  if (!aRows[0]) {
    return NextResponse.json(
      { success: false, error: "Set up your academy profile before uploading players" },
      { status: 400 },
    );
  }
  const academy = aRows[0];

  /* Parse + validate headers. */
  const rows = parseCsv(csv);
  if (rows.length < 2) {
    return NextResponse.json({ success: false, error: "CSV must have a header row and at least one data row" }, { status: 400 });
  }
  const [headerRow, ...dataRows] = rows;
  const headerMap: Record<number, string> = {};
  headerRow.forEach((h, i) => {
    const canonical = resolveHeader(h);
    if (canonical) headerMap[i] = canonical;
  });

  if (!Object.values(headerMap).some((h) => h === "name" || h === "first_name" || h === "last_name")) {
    return NextResponse.json(
      { success: false, error: "CSV must contain a name column (or first_name + last_name)" },
      { status: 400 },
    );
  }

  const results: InviteResult[] = [];
  const dryRun = Boolean(body.dry_run);

  for (let r = 0; r < dataRows.length; r++) {
    const row = dataRows[r];
    const data: Record<string, string> = {};
    for (let c = 0; c < row.length; c++) {
      const canonical = headerMap[c];
      if (canonical) data[canonical] = row[c].trim();
    }

    /* Build first/last name from whichever column was present. */
    let first = data.first_name ?? "";
    let last = data.last_name ?? "";
    if ((!first && !last) && data.name) {
      const split = splitFullName(data.name);
      first = split.first;
      last = split.last;
    }
    if (!first) {
      results.push({ row_index: r + 2, status: "error", error: "Missing name" });
      continue;
    }

    const displayName = `${first} ${last}`.trim();
    const email = data.email?.toLowerCase() || null;
    const phone = data.phone || null;
    const dob = parseDate(data.date_of_birth ?? "");

    /* Skip if an existing User with the same email is already linked to a profile. */
    if (email) {
      const existing = (await sql`
        SELECT pp.id
        FROM users u
        JOIN player_profiles pp ON pp.user_id = u.id
        WHERE u.email = ${email}
        LIMIT 1
      `) as unknown as Array<any>;
      if (existing.length > 0) {
        results.push({ row_index: r + 2, status: "skipped", name: displayName, email, error: "Player already on AthlasX" });
        continue;
      }
    }

    if (dryRun) {
      results.push({ row_index: r + 2, status: "created", name: displayName, email });
      continue;
    }

    try {
      /* Insert a draft player_profiles row WITHOUT a user_id — claim flow links it later. */
      const inserted = (await sql`
        INSERT INTO player_profiles (
          user_id, first_name, last_name, date_of_birth, gender,
          playing_role, batting_style, bowling_style,
          height_cm, weight_kg, city, state,
          academy_id, source_channel, created_by_user_id,
          profile_status, visibility, verification_level
        )
        VALUES (
          NULL, ${first}, ${last}, ${dob}, ${data.gender || null},
          ${data.playing_role || null}, ${data.batting_style || null}, ${data.bowling_style || null},
          ${data.height_cm ? Number(data.height_cm) : null}, ${data.weight_kg ? Number(data.weight_kg) : null},
          ${data.city || null}, ${data.state || null},
          ${academy.id}, 'Academy', ${adminId},
          'Draft', 'Private', 1
        )
        RETURNING id
      `) as unknown as Array<{ id: string }>;

      const profileId = inserted[0].id;
      const token = crypto.randomBytes(18).toString("base64url");

      await sql`
        INSERT INTO player_invites
          (token, academy_id, player_profile_id, invited_by_user_id, email, phone, invited_name, status, sent_at)
        VALUES
          (${token}, ${academy.id}, ${profileId}, ${adminId}, ${email}, ${phone}, ${displayName}, 'Sent', NOW())
      `;

      /* Best-effort notification — stubs log to console. */
      const claimUrl = `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/claim/${token}`;
      const messageBody =
        `${academy.academy_name} has created a AthlasX profile for you.\n\n` +
        `Claim it here: ${claimUrl}\n\n` +
        `You'll fill in any missing details and submit for approval.`;

      if (email) {
        await sendEmail({ to: email, subject: `Claim your AthlasX profile — ${academy.academy_name}`, body: messageBody });
      }
      if (phone) {
        await sendSms(phone, `AthlasX: ${academy.academy_name} created a profile for you. Claim it at ${claimUrl}`);
      }

      results.push({ row_index: r + 2, status: "created", name: displayName, email, player_profile_id: profileId, invite_token: token });
    } catch (e: any) {
      results.push({ row_index: r + 2, status: "error", name: displayName, email, error: e?.message ?? "Insert failed" });
    }
  }

  const summary = {
    total: dataRows.length,
    created: results.filter((r) => r.status === "created").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    errors:  results.filter((r) => r.status === "error").length,
  };

  return NextResponse.json({ success: true, summary, results, dry_run: dryRun });
}
