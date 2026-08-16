import type { Prisma, PrismaClient } from "@prisma/client";
import { db } from "@/lib/db";
import { nameSimilarity, normalizeDistrict, NAME_SIMILARITY_HIGH_CONFIDENCE } from "@/lib/identity-normalize";

type DbClient = PrismaClient | Prisma.TransactionClient;

export interface ResolveIdentityInput {
  associationId: string;
  nameRaw: string;
  dobRaw: Date | null;
  districtRaw: string | null;
}

export type ResolveIdentityOutcome =
  | { outcome: "HIGH_CONFIDENCE"; playerId: string }
  | { outcome: "AMBIGUOUS"; exceptionId: string }
  | { outcome: "NO_MATCH"; playerId: string };

/**
 * Ported from feat/w1-w8-and-association-auth's lib/identity-resolution.ts
 * (queueIdentityResolution), re-implemented against Prisma/PlayerProfile —
 * same three-branch shape, same threshold-gate + independent-corroboration
 * + explicit-tie-detection pattern. Deliberately does NOT rank candidates
 * by raw nameSimilarity score — that's what src/lib/string-similarity.ts's
 * academy-matching function does, and it's exactly what produces the
 * already-documented disambiguation collision (a true variant and a rival
 * scoring identically). This function only ever uses nameSimilarity as a
 * binary >=0.85 gate, corroborated by an independent DOB match and a
 * normalized-district match — a name-only tie routes to AMBIGUOUS instead
 * of guessing.
 *
 * Candidate pool excludes withdrawn-consent players, same as the reference
 * branch — a withdrawn player must never be re-attached to by future
 * resolution.
 */
export async function resolveIdentity(
  input: ResolveIdentityInput,
  client: DbClient = db,
): Promise<ResolveIdentityOutcome> {
  const candidates = await client.playerProfile.findMany({
    where: {
      association_id: input.associationId,
      consent_status: { not: "withdrawn" },
    },
    select: { id: true, full_name: true, dob: true, district: true },
  });

  const nameMatches = candidates.filter(
    (c) => nameSimilarity(c.full_name, input.nameRaw) >= NAME_SIMILARITY_HIGH_CONFIDENCE,
  );

  const fullyCorroborated = nameMatches.filter((c) => {
    const dobMatches = input.dobRaw ? sameDay(c.dob, input.dobRaw) : false;
    const districtMatches = input.districtRaw
      ? normalizeDistrict(c.district) === normalizeDistrict(input.districtRaw)
      : false;
    return dobMatches && districtMatches;
  });

  if (fullyCorroborated.length === 1) {
    return { outcome: "HIGH_CONFIDENCE", playerId: fullyCorroborated[0].id };
  }

  if (nameMatches.length > 0) {
    // Name matched but DOB/district didn't corroborate it (or corroborated
    // more than one candidate at once) — never guess, always queue.
    const reason = fullyCorroborated.length > 1 ? "MULTIPLE_CANDIDATES" : "AMBIGUOUS_MATCH";
    const exception = await client.identityException.create({
      data: {
        association_id: input.associationId,
        raw_name: input.nameRaw,
        raw_dob: input.dobRaw ?? undefined,
        raw_district: input.districtRaw ?? undefined,
        reason,
        candidate_player_ids: nameMatches.map((c) => c.id),
        status: "OPEN",
      },
    });
    return { outcome: "AMBIGUOUS", exceptionId: exception.id };
  }

  // No candidate cleared the threshold at all — create a new shadow profile.
  const created = await client.playerProfile.create({
    data: {
      full_name: input.nameRaw,
      dob: input.dobRaw ?? new Date(0),
      district: input.districtRaw ?? "",
      state: "",
      association_id: input.associationId,
      claim_status: "unclaimed",
      consent_status: "not_required",
      profile_source: "ingest",
    },
  });
  return { outcome: "NO_MATCH", playerId: created.id };
}

function sameDay(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear()
    && a.getUTCMonth() === b.getUTCMonth()
    && a.getUTCDate() === b.getUTCDate();
}
