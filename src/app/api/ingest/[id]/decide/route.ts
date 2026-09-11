import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/require-auth'
import { resolveVerifiedRequestedAssociationScope } from '@/lib/association/verification-gate'
import { resolveIdentity } from '@/lib/identity-resolution'
import { enqueueAcademyCapture } from '@/lib/academy-capture'
import type { NormalizedIngestPayload } from '@/lib/ingest/types'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(req, ['association', 'athlasx_ops'])
  if (auth instanceof NextResponse) return auth

  const { decision } = await req.json()
  if (decision !== 'approved' && decision !== 'rejected') {
    return NextResponse.json({ error: 'decision must be "approved" or "rejected"' }, { status: 400 })
  }

  const job = await db.ingestJob.findUnique({ where: { id: params.id } })
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  if (job.status !== 'pending_review') {
    return NextResponse.json({ error: 'Job is not pending review' }, { status: 409 })
  }
  if (job.association_id) {
    const scope = await resolveVerifiedRequestedAssociationScope(auth.user, job.association_id)
    if (scope !== null && !scope.includes(job.association_id)) {
      return NextResponse.json({ error: 'Forbidden — not scoped to this association' }, { status: 403 })
    }
  }

  if (decision === 'rejected') {
    const updated = await db.ingestJob.update({
      where: { id: params.id },
      data: { status: 'rejected', reviewed_by: auth.user.id, reviewed_at: new Date() },
    })
    return NextResponse.json({ job: updated })
  }

  // decision === 'approved' — the real write path. Everything below runs
  // in one transaction: a partial write (a Match with no Performances, or
  // Performances with no identity resolution/academy capture having run)
  // would leave the approval gate in a broken state.
  if (!job.association_id) {
    return NextResponse.json({ error: 'Job has no association_id — cannot create Tournament/Match rows' }, { status: 422 })
  }
  if (!job.raw_payload) {
    return NextResponse.json({ error: 'Job has no raw_payload — nothing to write' }, { status: 422 })
  }
  const payload = job.raw_payload as unknown as NormalizedIngestPayload

  const result = await db.$transaction(async (tx) => {
    // Find-or-create Tournament, idempotent on association+name+season —
    // mirrors the reference branch's unique-index convention.
    let tournament = await tx.tournament.findFirst({
      where: { association_id: job.association_id!, name: payload.tournamentName, season: payload.season },
    })
    if (!tournament) {
      tournament = await tx.tournament.create({
        data: {
          association_id: job.association_id!,
          name: payload.tournamentName,
          season: payload.season,
          format: payload.format,
          age_category: payload.ageCategory,
          level: payload.level,
          start_date: new Date(payload.matchDate),
        },
      })
    }

    const match = await tx.match.create({
      data: {
        tournament_id: tournament.id,
        date: new Date(payload.matchDate),
        home_team: payload.homeTeam,
        away_team: payload.awayTeam,
        venue: payload.venue,
        source: job.source,
        confidence: job.confidence,
        ingest_method: job.method,
        association_approval_status: 'approved',
      },
    })

    let identityResolved = 0
    let identityAmbiguous = 0
    const performances = []
    for (const row of payload.performances) {
      // W2 trigger — every performance row is resolved to a real player,
      // never left to guess, and runs inside the same transaction (tx)
      // resolveIdentity was extended to accept, so a partial resolve can
      // never survive a downstream failure in this same approval.
      const outcome = await resolveIdentity(
        {
          associationId: job.association_id!,
          nameRaw: row.full_name,
          dobRaw: row.dob ? new Date(row.dob) : null,
          districtRaw: row.district,
        },
        tx,
      )
      if (outcome.outcome === 'AMBIGUOUS') {
        identityAmbiguous++
        await tx.identityException.update({
          where: { id: outcome.exceptionId },
          data: {
            match_id: match.id,
            performance_snapshot: row as unknown as Prisma.InputJsonValue,
          },
        })
        continue // no Performance row without a resolved player_id
      }
      identityResolved++
      const performance = await tx.performance.create({
        data: {
          match_id: match.id,
          player_id: outcome.playerId,
          batting_runs: row.batting_runs,
          batting_balls: row.batting_balls,
          batting_dismissed: row.batting_dismissed,
          bowling_overs: row.bowling_overs,
          bowling_wickets: row.bowling_wickets,
          bowling_runs_conceded: row.bowling_runs_conceded,
          source: job.source,
          ingest_method: job.method,
          confidence_score: job.confidence,
        },
      })
      performances.push(performance)
    }

    // W8 trigger — one AcademyMatchCandidate per distinct raw academy
    // string on the payload, same transaction.
    const rawAcademyNames = Array.from(
      new Set(payload.performances.map((r) => r.academy_raw).filter((v): v is string => !!v)),
    )
    let academyCandidatesCreated = 0
    for (const rawName of rawAcademyNames) {
      const candidate = await enqueueAcademyCapture(rawName, job.source, tx)
      if (candidate) academyCandidatesCreated++
    }

    const updatedJob = await tx.ingestJob.update({
      where: { id: params.id },
      data: { status: 'approved', reviewed_by: auth.user.id, reviewed_at: new Date() },
    })

    return {
      job: updatedJob,
      tournamentId: tournament.id,
      matchId: match.id,
      performancesCreated: performances.length,
      identityResolved,
      identityAmbiguous,
      academyCandidatesCreated,
    }
  }, { timeout: 20_000 }) // default 5s is too tight for a real per-row resolveIdentity
  // + enqueueAcademyCapture loop over Neon's network latency, not a symptom
  // of doing something wrong — this transaction does a bounded, small
  // amount of work per ingest job, just several round trips of it.

  return NextResponse.json(result)
}
