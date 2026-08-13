import type { PlayingRole } from '@/types'
import type { VerifiedPerformanceRow } from '@/lib/athlasx-score'

// Deterministic pseudo-random match rows keyed by player id — stands in for
// real ingested Performance rows until the ingest pipeline writes them.
// Same player always produces the same numbers across reloads and across
// client/server. seedPerformances() (used by the score engine) and
// seedMatchHistory() (used by the record page's match list) are derived
// from the same underlying rows so the two views never disagree.
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashSeed(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0
  return h
}

export const dbRoleMap: Record<string, PlayingRole> = {
  Batsman: 'Batsman',
  Bowler: 'Bowler',
  All_rounder: 'All-rounder',
  Wicket_keeper_Batsman: 'Wicket-keeper Batsman',
}

const opponents = ['Agra XI', 'Varanasi Tigers', 'Lucknow XI', 'Meerut Strikers', 'Allahabad Kings', 'Kanpur Colts', 'Gorakhpur Warriors']
const tournaments = ['UPCA U-19 District League', 'Kanpur District T20 Cup', 'UPCA U-19 State Qualifier']

export interface SeedMatchRow {
  id: string
  opponent: string
  tournament: string
  date: string
  level: 'local' | 'district' | 'state' | 'national'
  batting_runs?: number
  batting_balls?: number
  batting_dismissed?: boolean
  bowling_overs?: number
  bowling_wickets?: number
  bowling_runs_conceded?: number
}

export function seedMatchHistory(playerId: string, role: PlayingRole): SeedMatchRow[] {
  const rand = mulberry32(hashSeed(playerId))
  const count = 12 + Math.floor(rand() * 12)
  const bats = role !== 'Bowler'
  const bowls = role === 'Bowler' || role === 'All-rounder'
  const now = Date.now()
  const DAY = 24 * 3600 * 1000

  return Array.from({ length: count }, (_, i) => ({
    id: `${playerId}-m${i}`,
    opponent: opponents[Math.floor(rand() * opponents.length)],
    tournament: tournaments[Math.floor(rand() * tournaments.length)],
    date: new Date(now - (count - i) * 9 * DAY).toISOString(),
    level: 'district' as const,
    ...(bats ? {
      batting_runs: Math.round(15 + rand() * 45),
      batting_balls: Math.round(20 + rand() * 25),
      batting_dismissed: rand() > 0.25,
    } : {}),
    ...(bowls ? {
      bowling_overs: 4,
      bowling_wickets: rand() > 0.6 ? Math.round(1 + rand() * 2) : rand() > 0.3 ? 1 : 0,
      bowling_runs_conceded: Math.round(18 + rand() * 20),
    } : {}),
  }))
}

export function seedPerformances(playerId: string, role: PlayingRole): VerifiedPerformanceRow[] {
  return seedMatchHistory(playerId, role).map(m => ({
    level: m.level,
    batting_runs: m.batting_runs,
    batting_balls: m.batting_balls,
    batting_dismissed: m.batting_dismissed,
    bowling_overs: m.bowling_overs,
    bowling_wickets: m.bowling_wickets,
    bowling_runs_conceded: m.bowling_runs_conceded,
  }))
}
