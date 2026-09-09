import { NextRequest, NextResponse } from "next/server";
import type { BattingStyle, Gender, PlayingRoleEnum } from "@prisma/client";
import { requireRole } from "@/lib/require-auth";
import { academyGate } from "@/lib/academy/gate";
import { getOwnedAcademy } from "@/lib/academy/scope";
import { addPlayerFromCsv } from "@/lib/academy/players";

export const dynamic = "force-dynamic";

// docs/AthlasX_Master_Data_Points.docx rule #4 — exactly these 8 columns,
// in this order: Name, DOB, Gender, Role, Batting style, State, Batch,
// Guardian (if minor). No District column — inherited from the importing
// academy's own district/state, never re-specified per row.
type CsvRow = {
  full_name?: unknown;
  dob?: unknown;
  gender?: unknown;
  playing_role?: unknown;
  batting_style?: unknown;
  state?: unknown;
  batch?: unknown;
  guardian?: unknown;
};

const GENDER_MAP: Record<string, Gender> = {
  male: "male", m: "male",
  female: "female", f: "female",
  other: "other",
};

const PLAYING_ROLE_MAP: Record<string, PlayingRoleEnum> = {
  batsman: "Batsman",
  bowler: "Bowler",
  "all-rounder": "All_rounder", allrounder: "All_rounder", all_rounder: "All_rounder",
  "wicket-keeper": "Wicket_keeper_Batsman", wicketkeeper: "Wicket_keeper_Batsman", wk: "Wicket_keeper_Batsman",
};

const BATTING_STYLE_MAP: Record<string, BattingStyle> = {
  "right-hand": "Right_handed", right: "Right_handed", rhb: "Right_handed", right_handed: "Right_handed",
  "left-hand": "Left_handed", left: "Left_handed", lhb: "Left_handed", left_handed: "Left_handed",
};

/**
 * POST — Add Players' CSV Upload tab: create many players in one request.
 * Each row succeeds or fails independently — a bad row never rolls back
 * the good ones. Batch is always free text (batch_label) here — CSV rows
 * are never matched against real AcademyBatch rows by name (see
 * addPlayerFromCsv's own header comment for why).
 */
export async function POST(req: NextRequest) {
  const gate = academyGate();
  if (gate) return gate;
  const auth = await requireRole(req, ["academy_admin"]);
  if (auth instanceof NextResponse) return auth;

  const academy = await getOwnedAcademy(auth.user.id);
  if (!academy) return NextResponse.json({ error: "Set up your academy first" }, { status: 400 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rows: CsvRow[] = Array.isArray(body?.rows) ? body.rows : [];
  if (!rows.length) return NextResponse.json({ error: "rows must be a non-empty array" }, { status: 400 });
  if (rows.length > 500) return NextResponse.json({ error: "Max 500 rows per upload" }, { status: 400 });

  const results = await Promise.all(
    rows.map(async (row, i) => {
      const fullName = String(row.full_name ?? "").trim();
      const dobRaw = String(row.dob ?? "").trim();
      const genderRaw = String(row.gender ?? "").trim().toLowerCase();
      const roleRaw = String(row.playing_role ?? "").trim().toLowerCase();
      const battingRaw = String(row.batting_style ?? "").trim().toLowerCase();
      const state = String(row.state ?? "").trim();
      const batchLabel = String(row.batch ?? "").trim();
      const guardian = String(row.guardian ?? "").trim();

      if (!fullName) return { row: i, ok: false, error: "Missing name" };
      const dob = new Date(dobRaw);
      if (!dobRaw || Number.isNaN(dob.getTime())) return { row: i, ok: false, error: "Invalid DOB" };
      if (!genderRaw || !GENDER_MAP[genderRaw]) return { row: i, ok: false, error: "Invalid or missing gender" };
      if (!roleRaw || !PLAYING_ROLE_MAP[roleRaw]) return { row: i, ok: false, error: "Invalid or missing role" };
      if (!battingRaw || !BATTING_STYLE_MAP[battingRaw]) return { row: i, ok: false, error: "Invalid or missing batting style" };
      if (!state) return { row: i, ok: false, error: "Missing state" };

      const result = await addPlayerFromCsv(
        academy.id,
        academy.district,
        state,
        {
          full_name: fullName,
          dob,
          gender: GENDER_MAP[genderRaw],
          playing_role: PLAYING_ROLE_MAP[roleRaw],
          batting_style: BATTING_STYLE_MAP[battingRaw],
          guardian_phone: guardian || null,
          batch_label: batchLabel || null,
        },
        auth.user.id,
      );
      if (!result.ok) return { row: i, ok: false, error: result.error };
      return { row: i, ok: true, player_id: result.player_id };
    }),
  );

  return NextResponse.json({
    results,
    succeeded: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
  });
}
