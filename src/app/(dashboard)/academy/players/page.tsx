'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Search, User } from 'lucide-react'
import { AcademyShell, CARD_CLS, CONTROL_CLS, EYEBROW_CLS, H1_CLS } from '../_theme'

/**
 * Players surface — adapted from design/import/AthlasX Academy Admin
 * Dashboard.html's Players column + Player Detail panel (which
 * design/import/AthlasX Player Profile.html expands into a full page for
 * the same underlying data — see this session's decision that Player
 * Profile.html belongs to this admin surface, not to /record or /profile).
 *
 * Not carried over: Coach Notes, Video Highlights, Fitness, Career Stats,
 * Attendance arc, and Form squares — none of those have a backing data
 * model for academy-scoped players (CoachAdvisoryNote/SessionAttendance
 * are Squad-scoped, a different subsystem; see
 * src/lib/academy/attendance-flags.ts's header comment). Only fields that
 * are real columns on PlayerProfile are shown.
 */

interface AcademyPlayer {
  id: string
  name: string
  dob: string | null
  age: number | null
  is_minor: boolean
  playing_role: string | null
  batting_style: string | null
  district: string | null
  state: string | null
  guardian_phone: string | null
  batch_id: string
  batch_name: string
}

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
}

function fieldLabel(v: string | null) {
  return v ? v.replace(/_/g, ' ') : '—'
}

export default function AcademyPlayersPage() {
  const [players, setPlayers] = useState<AcademyPlayer[] | null>(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/academy/players')
      .then(async (r) => {
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || 'Failed to load players')
        setPlayers(d.players)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load players'))
  }, [])

  const filtered = useMemo(() => {
    if (!players) return []
    const q = query.trim().toLowerCase()
    if (!q) return players
    return players.filter((p) => p.name.toLowerCase().includes(q) || p.batch_name.toLowerCase().includes(q))
  }, [players, query])

  const selected = players?.find((p) => p.id === selectedId) ?? filtered[0] ?? null

  return (
    <AcademyShell>
      <div className="max-w-[1200px] mx-auto p-6 sm:p-8 space-y-5">
        <div>
          <p className={EYEBROW_CLS}>Academy Admin</p>
          <h1 className={H1_CLS}>Players</h1>
        </div>

        {error && <p className="text-sm text-[color:var(--bad)]">{error}</p>}

        {!players && !error ? (
          <div className="p-8 flex items-center justify-center text-[color:var(--text-dim)]"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : (
          <div className="grid lg:grid-cols-[1fr_1.1fr] gap-4 items-start">
            <div className={CARD_CLS + ' overflow-hidden'}>
              <div className="p-4 border-b border-[color:var(--line)] flex items-center gap-2">
                <Search className="w-4 h-4 text-[color:var(--text-faint)] shrink-0" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search players or batch…"
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-[color:var(--text-faint)]" />
                <span className="font-[family-name:var(--font-mono-jb)] text-[12px] text-[color:var(--text-dim)] shrink-0">{filtered.length}</span>
              </div>
              <div className="max-h-[560px] overflow-y-auto">
                {players?.length === 0 && <p className="p-6 text-sm text-[color:var(--text-faint)]">No players yet. Add players to get started.</p>}
                {players && players.length > 0 && filtered.length === 0 && <p className="p-6 text-sm text-[color:var(--text-faint)]">No players match.</p>}
                {filtered.map((p) => (
                  <button key={p.id} type="button" onClick={() => setSelectedId(p.id)}
                    className={
                      'w-full flex items-center gap-3 text-left px-4 py-3 border-b border-[color:var(--line)] last:border-b-0 transition-colors ' +
                      (selected?.id === p.id ? 'bg-[rgba(255,138,30,0.1)]' : 'hover:bg-white/[0.02]')
                    }>
                    <div className="w-9 h-9 rounded-full bg-[rgba(255,138,30,0.16)] border border-[color:var(--accent)] flex items-center justify-center text-[12px] font-bold text-[color:var(--accent-bright)] shrink-0">
                      {initials(p.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-bold truncate">{p.name}</p>
                        {p.is_minor && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[color:var(--accent)] text-[#1a0e02] shrink-0">MINOR</span>}
                      </div>
                      <p className="text-[12px] text-[color:var(--text-faint)] truncate">{p.batch_name}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className={CARD_CLS + ' p-5 min-h-[200px]'}>
              {!selected ? (
                <div className="h-full flex items-center justify-center text-sm text-[color:var(--text-faint)] py-10">
                  <User className="w-4 h-4 mr-2" /> Select a player to view their profile.
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-[rgba(255,138,30,0.16)] border-2 border-[color:var(--accent)] flex items-center justify-center text-sm font-bold text-[color:var(--accent-bright)] shrink-0">
                      {initials(selected.name)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-[15px] font-bold">{selected.name}</p>
                        {selected.is_minor && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[color:var(--accent)] text-[#1a0e02]">MINOR</span>}
                      </div>
                      <p className="text-[12px] text-[color:var(--text-dim)]">{selected.batch_name}</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-[11px] font-bold uppercase tracking-wide text-[color:var(--text-faint)] border-b border-[color:var(--line)] pb-2 mb-2">Profile</h3>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                      <div><p className="text-[11px] text-[color:var(--text-faint)] uppercase">Age</p><p className="text-sm font-semibold mt-0.5">{selected.age != null ? `${selected.age} yrs` : '—'}</p></div>
                      <div><p className="text-[11px] text-[color:var(--text-faint)] uppercase">Batch</p><p className="text-sm font-semibold mt-0.5">{selected.batch_name}</p></div>
                      <div><p className="text-[11px] text-[color:var(--text-faint)] uppercase">State / District</p><p className="text-sm font-semibold mt-0.5">{selected.state || '—'} / {selected.district || '—'}</p></div>
                      <div><p className="text-[11px] text-[color:var(--text-faint)] uppercase">Guardian Phone</p><p className="text-sm font-semibold mt-0.5">{selected.guardian_phone || (selected.is_minor ? 'Not provided' : 'N/A')}</p></div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-[11px] font-bold uppercase tracking-wide text-[color:var(--text-faint)] border-b border-[color:var(--line)] pb-2 mb-2">Playing Style</h3>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                      <div><p className="text-[11px] text-[color:var(--text-faint)] uppercase">Role</p><p className="text-sm font-semibold mt-0.5">{fieldLabel(selected.playing_role)}</p></div>
                      <div><p className="text-[11px] text-[color:var(--text-faint)] uppercase">Batting</p><p className="text-sm font-semibold mt-0.5">{fieldLabel(selected.batting_style)}</p></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AcademyShell>
  )
}
