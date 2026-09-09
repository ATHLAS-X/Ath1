import { db } from "@/lib/db";
import { loadOwnedActiveBatch, isBatchArchived } from "@/lib/academy/batches";
import type { PlayingRoleEnum, BattingStyle, BowlingStyleEnum, Gender } from "@prisma/client";

/**
 * Academy-admin "add a player directly" path (design/import/AthlasX Add
 * Players.html's Manual Entry + CSV Upload tabs) — distinct from the
 * guardian-initiated self-registration flow in join-requests.ts, which
 * lands in a pending queue for the admin to approve.
 *
 * ProfileSource only has three values (ingest, self_registered,
 * academy_join_request) — there is no "admin added" value, and adding one
 * means a schema migration this task doesn't authorize. An admin-added
 * player is modeled as an AcademyJoinRequest created and approved in the
 * same transaction (status "approved", reviewed_by = the admin), which
 * keeps profile_source: academy_join_request accurate (it did arrive
 * through the academy's own add-player mechanism) and gives every
 * academy-admin-added player the same audit trail (reviewed_by/reviewed_at)
 * a guardian-submitted request gets on approval.
 */

export type AcademyPlayerRow = {
  id: string;
  name: string;
  dob: string | null;
  age: number | null;
  is_minor: boolean;
  playing_role: string | null;
  batting_style: string | null;
  district: string | null;
  state: string | null;
  guardian_phone: string | null;
  batch_id: string;
  batch_name: string;
};

function ageFromDob(dob: Date | null): number | null {
  if (!dob) return null;
  const diff = Date.now() - dob.getTime();
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
}

/** Every active player across this academy's batches, for the Players surface. */
export async function listAcademyPlayers(academyId: string): Promise<AcademyPlayerRow[]> {
  const memberships = await db.academyBatchMembership.findMany({
    where: { status: "active", batch: { academy_id: academyId } },
    include: { player: true, batch: true },
    orderBy: { joined_at: "desc" },
  });

  return memberships.map((m) => {
    const age = ageFromDob(m.player.dob);
    return {
      id: m.player.id,
      name: m.player.full_name,
      dob: m.player.dob ? m.player.dob.toISOString() : null,
      age,
      is_minor: age != null && age < 18,
      playing_role: m.player.playing_role ?? null,
      batting_style: m.player.batting_style ?? null,
      district: m.player.district ?? null,
      state: m.player.state ?? null,
      guardian_phone: m.player.guardian_phone ?? null,
      batch_id: m.batch_id,
      batch_name: m.batch.batch_name,
    };
  });
}

export type AddPlayerInput = {
  full_name: string;
  dob: Date;
  district: string;
  state: string;
  playing_role: PlayingRoleEnum | null;
  batting_style: BattingStyle | null;
  bowling_style: BowlingStyleEnum | null;
  guardian_name: string | null;
  guardian_phone: string | null;
};

/** Create a player and place them in a batch in one action, with an approved
 *  join-request row for audit parity with the guardian-submitted queue. */
export async function addPlayerDirectly(
  academyId: string,
  batchId: string,
  input: AddPlayerInput,
  adminUserId: string,
): Promise<{ ok: true; player_id: string } | { ok: false; error: string; status: 400 | 404 }> {
  const batch = await loadOwnedActiveBatch(academyId, batchId);
  if (!batch) return { ok: false, error: "Batch not found", status: 404 };
  if (isBatchArchived(batch)) {
    return { ok: false, error: "Cannot add players to an archived batch", status: 400 };
  }

  const isMinor = ageFromDob(input.dob) != null && (ageFromDob(input.dob) as number) < 18;
  if (isMinor && (!input.guardian_name || !input.guardian_phone)) {
    return { ok: false, error: "Guardian name and phone are required for a minor", status: 400 };
  }

  const playerId = await db.$transaction(async (tx) => {
    const player = await tx.playerProfile.create({
      data: {
        full_name: input.full_name,
        dob: input.dob,
        district: input.district,
        state: input.state,
        playing_role: input.playing_role,
        batting_style: input.batting_style,
        bowling_style: input.bowling_style,
        guardian_phone: input.guardian_phone,
        profile_source: "academy_join_request",
        association_id: null,
      },
    });

    await tx.academyBatchMembership.create({
      data: { batch_id: batchId, player_id: player.id },
    });

    await tx.academyJoinRequest.create({
      data: {
        academy_id: academyId,
        candidate_name: input.full_name,
        candidate_dob: input.dob,
        player_id: player.id,
        status: "approved",
        reviewed_by: adminUserId,
        reviewed_at: new Date(),
      },
    });

    return player.id;
  });

  return { ok: true, player_id: playerId };
}

export type CsvPlayerInput = {
  full_name: string;
  dob: Date;
  gender: Gender | null;
  playing_role: PlayingRoleEnum | null;
  batting_style: BattingStyle | null;
  guardian_phone: string | null;
  // docs/AthlasX_Master_Data_Points.docx rule #4 — the admin CSV template
  // is exactly 8 columns (Name, DOB, Gender, Role, Batting style, State,
  // Batch, Guardian). Batch always lands in the free-text batch_label
  // field, never resolved to a real AcademyBatch/AcademyBatchMembership —
  // that requires a batch to already exist and be picked deliberately
  // (see addPlayerDirectly/ManualTab above), which a CSV row can't do
  // safely by name-matching alone. District/state are NOT CSV columns —
  // inherited from the importing academy itself, not per-row.
  batch_label: string | null;
};

/** CSV-import counterpart to addPlayerDirectly — no batch match required,
 *  no AcademyBatchMembership row created. Still creates an approved
 *  AcademyJoinRequest for the same audit-trail parity. */
export async function addPlayerFromCsv(
  academyId: string,
  academyDistrict: string,
  academyState: string,
  input: CsvPlayerInput,
  adminUserId: string,
): Promise<{ ok: true; player_id: string } | { ok: false; error: string; status: 400 }> {
  const isMinor = ageFromDob(input.dob) != null && (ageFromDob(input.dob) as number) < 18;
  if (isMinor && !input.guardian_phone) {
    return { ok: false, error: "Guardian is required for a minor", status: 400 };
  }

  const playerId = await db.$transaction(async (tx) => {
    const player = await tx.playerProfile.create({
      data: {
        full_name: input.full_name,
        dob: input.dob,
        district: academyDistrict,
        state: academyState,
        gender: input.gender ?? undefined,
        playing_role: input.playing_role,
        batting_style: input.batting_style,
        guardian_phone: input.guardian_phone,
        batch_label: input.batch_label ?? undefined,
        profile_source: "academy_join_request",
        association_id: null,
      },
    });

    await tx.academyJoinRequest.create({
      data: {
        academy_id: academyId,
        candidate_name: input.full_name,
        candidate_dob: input.dob,
        player_id: player.id,
        status: "approved",
        reviewed_by: adminUserId,
        reviewed_at: new Date(),
      },
    });

    return player.id;
  });

  return { ok: true, player_id: playerId };
}
