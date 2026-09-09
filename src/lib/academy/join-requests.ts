import { db } from "@/lib/db";
import { isBatchArchived, loadOwnedActiveBatch } from "@/lib/academy/batches";

/**
 * Academy join-request queue. Ported from origin/v1-features-sparsh
 * (lib/academy/join-requests.ts), which modeled a "join request" as a
 * PlayerProfile row with profile_status='Pending Approval' against a
 * hand-rolled schema with no dedicated request table. Main's PlayerProfile
 * has no such status/city/source_channel columns, so this port introduces a
 * dedicated AcademyJoinRequest model (prisma/schema.prisma) instead of
 * bolting sparsh's ad-hoc columns onto PlayerProfile — approval creates (or
 * reactivates) a real PlayerProfile + AcademyBatchMembership row.
 */

export type JoinRequestRow = {
  id: string;
  name: string;
  age: number | null;
  candidate_phone: string | null;
  submitted_at: string | null;
};

function ageFromDob(dob: Date | null): number | null {
  if (!dob) return null;
  const diff = Date.now() - dob.getTime();
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
}

/** Pending join requests for one academy (academy-admin queue). */
export async function listPendingJoinRequests(academyId: string): Promise<JoinRequestRow[]> {
  const rows = await db.academyJoinRequest.findMany({
    where: { academy_id: academyId, status: "pending" },
    orderBy: { created_at: "asc" },
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.candidate_name,
    age: ageFromDob(row.candidate_dob),
    candidate_phone: row.candidate_phone ?? null,
    submitted_at: row.created_at.toISOString(),
  }));
}

/**
 * Approve a pending join request into a batch in one action: creates (or
 * reuses, if already linked to a player) the PlayerProfile and places it in
 * the batch, then marks the request approved.
 */
export async function approveJoinRequest(
  academyId: string,
  requestId: string,
  batchId: string,
  reviewedByUserId: string,
): Promise<
  | { ok: true; player_id: string }
  | { ok: false; error: string; status: 400 | 404 }
> {
  const batch = await loadOwnedActiveBatch(academyId, batchId);
  if (!batch) return { ok: false, error: "Batch not found", status: 404 };
  if (isBatchArchived(batch)) {
    return { ok: false, error: "Cannot approve into an archived batch", status: 400 };
  }

  const request = await db.academyJoinRequest.findFirst({
    where: { id: requestId, academy_id: academyId, status: "pending" },
  });
  if (!request) {
    return { ok: false, error: "Join request not found or already handled", status: 404 };
  }

  const player = await db.$transaction(async (tx) => {
    const playerId =
      request.player_id ??
      (
        await tx.playerProfile.create({
          data: {
            full_name: request.candidate_name,
            dob: request.candidate_dob ?? new Date("2000-01-01"),
            district: "",
            state: "",
            profile_source: "academy_join_request",
            association_id: null,
          },
        })
      ).id;

    await tx.academyBatchMembership.upsert({
      where: { batch_id_player_id: { batch_id: batchId, player_id: playerId } },
      create: { batch_id: batchId, player_id: playerId },
      update: { status: "active" },
    });

    await tx.academyJoinRequest.update({
      where: { id: request.id },
      data: {
        status: "approved",
        player_id: playerId,
        reviewed_by: reviewedByUserId,
        reviewed_at: new Date(),
      },
    });

    return playerId;
  });

  return { ok: true, player_id: player };
}

/** Reject a pending join request (no batch involved). */
export async function rejectJoinRequest(
  academyId: string,
  requestId: string,
  reviewedByUserId: string,
): Promise<{ ok: true } | { ok: false; error: string; status: 404 }> {
  const request = await db.academyJoinRequest.findFirst({
    where: { id: requestId, academy_id: academyId, status: "pending" },
  });
  if (!request) {
    return { ok: false, error: "Join request not found or already handled", status: 404 };
  }

  await db.academyJoinRequest.update({
    where: { id: request.id },
    data: { status: "rejected", reviewed_by: reviewedByUserId, reviewed_at: new Date() },
  });
  return { ok: true };
}
