import type { Prisma, PrismaClient } from '@prisma/client'
import { db } from '@/lib/db'
import { similarity } from '@/lib/string-similarity'

type DbClient = PrismaClient | Prisma.TransactionClient

export const AUTO_ATTACH_THRESHOLD = 0.9
const SUGGEST_THRESHOLD = 0.65

/**
 * W8 — enqueues one raw academy/club string from an approved match into
 * the academy reconciliation queue (AcademyMatchCandidate, consumed by the
 * real /api/academy-matching/** routes). Reuses the same similarity()
 * function those routes already use for confirm/reject, rather than
 * introducing a second matcher — same disambiguation caveat applies (see
 * the comparison report's W8 findings): this never auto-merges above the
 * threshold without a suggestion still requiring human confirm, it only
 * skips the "unmatched" bucket for very high-confidence hits.
 */
export async function enqueueAcademyCapture(
  rawAcademyName: string,
  source: string,
  client: DbClient = db,
): Promise<{ candidateId: string; status: string } | null> {
  const trimmed = rawAcademyName.trim()
  if (!trimmed) return null

  const academies = await client.academy.findMany({ select: { id: true, name: true, name_variants: true } })
  let best: { id: string; score: number } | null = null
  for (const a of academies) {
    const score = Math.max(similarity(trimmed, a.name), ...a.name_variants.map((v) => similarity(trimmed, v)))
    if (!best || score > best.score) best = { id: a.id, score }
  }

  const status = !best
    ? 'unmatched'
    : best.score >= AUTO_ATTACH_THRESHOLD
      ? 'suggested' // still human-confirmed, never auto-merged — see doc comment
      : best.score >= SUGGEST_THRESHOLD
        ? 'suggested'
        : 'unmatched'

  const candidate = await client.academyMatchCandidate.create({
    data: {
      raw_string: trimmed,
      source,
      suggested_academy_id: status === 'suggested' ? best!.id : undefined,
      similarity_score: best?.score,
      status,
    },
  })
  return { candidateId: candidate.id, status: candidate.status }
}
