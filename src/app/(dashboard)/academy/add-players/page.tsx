'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Upload, Copy, CheckCircle2 } from 'lucide-react'
import { AcademyShell, CARD_CLS, CONTROL_CLS, LABEL_CLS, BTN_AMBER_CLS, BTN_GHOST_CLS, EYEBROW_CLS, H1_CLS } from '../_theme'
import { ageFromDob } from '@/lib/age'

/**
 * Add Players — the three tabs from design/import/AthlasX Add Players.html:
 * CSV Upload, Manual Entry, QR/WhatsApp Invite.
 *
 * The mockup's QR code is decorative (a seeded-random SVG grid, not a real
 * scannable QR — see its own inline comment "simple QR-like placeholder
 * pattern... no external deps"). No QR-generation library is a dependency
 * of this project, so that tab here is copy-the-link + WhatsApp share only;
 * adding a real QR renderer wasn't asked for and is a one-line addition
 * later if wanted.
 */

interface Batch { id: string; name: string; age_group: string }

const PLAYING_ROLES = [
  { v: 'Batsman', label: 'Batsman' },
  { v: 'Bowler', label: 'Bowler' },
  { v: 'All_rounder', label: 'All-Rounder' },
  { v: 'Wicket_keeper_Batsman', label: 'WK' },
]
const BATTING_STYLES = [
  { v: 'Right_handed', label: 'Right-hand' },
  { v: 'Left_handed', label: 'Left-hand' },
]
const STATES = ['Karnataka', 'Maharashtra', 'Tamil Nadu', 'Delhi', 'Punjab', 'Kerala', 'Gujarat', 'West Bengal']

function ageOf(dobStr: string): number | null {
  const d = new Date(dobStr)
  if (Number.isNaN(d.getTime())) return null
  return ageFromDob(d)
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={
        'px-4 py-2.5 rounded-full text-sm font-bold border-[1.5px] transition-all whitespace-nowrap ' +
        (active ? 'bg-[color:var(--accent)] border-[color:var(--accent)] text-[#1a0e02]' : 'bg-[color:var(--panel)] border-[color:var(--line)] text-[color:var(--text-dim)] hover:border-[#3a4f63] hover:text-[color:var(--text)]')
      }>
      {children}
    </button>
  )
}

export default function AddPlayersPage() {
  const [tab, setTab] = useState<'csv' | 'manual' | 'invite'>('csv')
  const [academy, setAcademy] = useState<{ id: string; name: string } | null>(null)
  const [batches, setBatches] = useState<Batch[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/academy/dashboard')
      .then(async (r) => {
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || 'Failed to load academy')
        if (d.academy) setAcademy(d.academy)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load academy'))
    fetch('/api/academy/batches').then((r) => r.json()).then((d) => setBatches(d.batches ?? []))
  }, [])

  if (error) {
    return (
      <AcademyShell>
        <div className="p-8 text-sm text-[color:var(--bad)]">{error}</div>
      </AcademyShell>
    )
  }

  return (
    <AcademyShell>
      <div className="max-w-[1000px] mx-auto p-6 sm:p-8 space-y-5">
        <div>
          <p className={EYEBROW_CLS}>
            Athlas<span className="text-[color:var(--accent)]">X</span> · Academy Admin
          </p>
          <h1 className={H1_CLS}>Add Players to {academy?.name ?? '…'}</h1>
        </div>

        <div className="flex gap-2 flex-wrap">
          <TabButton active={tab === 'csv'} onClick={() => setTab('csv')}>1. CSV Upload</TabButton>
          <TabButton active={tab === 'manual'} onClick={() => setTab('manual')}>2. Manual Entry</TabButton>
          <TabButton active={tab === 'invite'} onClick={() => setTab('invite')}>3. QR / WhatsApp Invite</TabButton>
        </div>

        <div className={CARD_CLS + ' p-6'}>
          {tab === 'csv' && <CsvTab />}
          {tab === 'manual' && <ManualTab batches={batches} />}
          {tab === 'invite' && <InviteTab academy={academy} />}
        </div>
      </div>
    </AcademyShell>
  )
}

// docs/AthlasX_Master_Data_Points.docx rule #4 — exactly these 8 columns,
// in this order. No District column — inherited from the importing
// academy's own district/state, never re-specified per row.
const CSV_COLUMNS = ['full_name', 'dob', 'gender', 'playing_role', 'batting_style', 'state', 'batch', 'guardian'] as const
const CSV_HEADER_LABELS = ['Name', 'DOB', 'Gender', 'Role', 'Batting style', 'State', 'Batch', 'Guardian (if minor)']

type CsvRow = Record<(typeof CSV_COLUMNS)[number], string>

function CsvTab() {
  const [rows, setRows] = useState<CsvRow[] | null>(null)
  const [results, setResults] = useState<{ row: number; ok: boolean; error?: string }[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [parseError, setParseError] = useState('')

  function downloadTemplate() {
    const csv = CSV_COLUMNS.join(',') + '\n'
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'athlasx_player_template.csv'
    a.click()
  }

  function handleFile(file: File) {
    setResults(null)
    setParseError('')
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result ?? '')
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
      if (lines.length < 2) { setParseError('CSV must have a header row plus at least one player row.'); return }
      const header = lines[0].split(',').map((h) => h.trim().toLowerCase())
      const parsed = lines.slice(1).map((line) => {
        const cells = line.split(',').map((c) => c.trim())
        const get = (col: string) => cells[header.indexOf(col)] ?? ''
        return Object.fromEntries(CSV_COLUMNS.map((c) => [c, get(c)])) as CsvRow
      })
      setRows(parsed)
    }
    reader.readAsText(file)
  }

  async function uploadAll() {
    if (!rows?.length) return
    setBusy(true)
    try {
      const res = await fetch('/api/academy/players/bulk', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setResults(data.results)
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <label className="block border-2 border-dashed border-[color:var(--accent)] rounded-xl p-10 text-center bg-[rgba(255,138,30,0.05)] hover:bg-[rgba(255,138,30,0.09)] transition-colors cursor-pointer">
        <Upload className="w-10 h-10 text-[color:var(--accent)] mx-auto mb-2" />
        <p className="text-sm font-bold">Click to choose a CSV file</p>
        <p className="text-[13px] text-[color:var(--text-dim)] mt-1">Columns: full_name, dob, gender, playing_role, batting_style, state, batch, guardian — one row per player</p>
        <input type="file" accept=".csv" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
      </label>
      <div className="flex justify-center">
        <button type="button" onClick={downloadTemplate} className="text-[13px] font-bold text-[color:var(--accent-bright)] hover:text-[color:var(--accent)]">Download CSV Template</button>
      </div>

      {parseError && <p className="text-sm text-[color:var(--bad)]">{parseError}</p>}

      {rows && (
        <div className="space-y-3">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] border-collapse">
              <thead>
                <tr>
                  {CSV_HEADER_LABELS.map((h) => (
                    <th key={h} className="text-left px-3 py-2 text-[11px] uppercase tracking-wide text-[color:var(--text-faint)] border-b border-[color:var(--line)]">{h}</th>
                  ))}
                  {results && <th className="text-left px-3 py-2 text-[11px] uppercase tracking-wide text-[color:var(--text-faint)] border-b border-[color:var(--line)]">Result</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const result = results?.find((x) => x.row === i)
                  return (
                    <tr key={i} className="border-b border-[color:var(--line)]">
                      <td className="px-3 py-2">{r.full_name || '—'}</td>
                      <td className="px-3 py-2">{r.dob || '—'}</td>
                      <td className="px-3 py-2">{r.gender || '—'}</td>
                      <td className="px-3 py-2">{r.playing_role || '—'}</td>
                      <td className="px-3 py-2">{r.batting_style || '—'}</td>
                      <td className="px-3 py-2">{r.state || '—'}</td>
                      <td className="px-3 py-2">{r.batch || '—'}</td>
                      <td className="px-3 py-2">{r.guardian || '—'}</td>
                      {results && (
                        <td className="px-3 py-2">
                          {result?.ok ? <span className="text-[color:var(--ok)] font-bold">Added</span> : <span className="text-[color:var(--bad)] font-bold">{result?.error}</span>}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={uploadAll} disabled={busy} className={BTN_AMBER_CLS}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin inline" /> : `Upload ${rows.length} row${rows.length === 1 ? '' : 's'}`}
            </button>
            <button type="button" onClick={() => { setRows(null); setResults(null) }} className={BTN_GHOST_CLS}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

function ManualTab({ batches }: { batches: Batch[] | null }) {
  const [fullName, setFullName] = useState('')
  const [dob, setDob] = useState('')
  const [playingRole, setPlayingRole] = useState('Batsman')
  const [battingStyle, setBattingStyle] = useState('Right_handed')
  const [state, setState] = useState(STATES[0])
  const [district, setDistrict] = useState('')
  const [batchId, setBatchId] = useState('')
  const [guardianName, setGuardianName] = useState('')
  const [guardianPhone, setGuardianPhone] = useState('')
  const [continueAdding, setContinueAdding] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [added, setAdded] = useState(false)

  const isMinor = useMemo(() => { const a = ageOf(dob); return a != null && a < 18 }, [dob])

  async function submit() {
    setError(''); setAdded(false)
    if (!fullName.trim() || !dob || !batchId) { setError('Full name, date of birth and batch are required.'); return }
    if (isMinor && (!guardianName.trim() || guardianPhone.replace(/\D/g, '').length !== 10)) {
      setError('Guardian name and a 10-digit guardian phone are required for a minor.'); return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/academy/players', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName, dob, playing_role: playingRole, batting_style: battingStyle,
          state, district, batch_id: batchId, guardian_name: guardianName, guardian_phone: guardianPhone,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to add player')
      setAdded(true)
      if (continueAdding) {
        setFullName(''); setDob(''); setDistrict(''); setGuardianName(''); setGuardianPhone('')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add player')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <div><label className={LABEL_CLS}>Full Name *</label><input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Rohan Sharma" className={CONTROL_CLS} /></div>
      <div><label className={LABEL_CLS}>Date of Birth *</label><input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className={CONTROL_CLS} /></div>

      <div><label className={LABEL_CLS}>Primary Playing Role</label>
        <select value={playingRole} onChange={(e) => setPlayingRole(e.target.value)} className={CONTROL_CLS}>
          {PLAYING_ROLES.map((r) => <option key={r.v} value={r.v}>{r.label}</option>)}
        </select>
      </div>
      <div><label className={LABEL_CLS}>Batting Style</label>
        <select value={battingStyle} onChange={(e) => setBattingStyle(e.target.value)} className={CONTROL_CLS}>
          {BATTING_STYLES.map((b) => <option key={b.v} value={b.v}>{b.label}</option>)}
        </select>
      </div>

      <div><label className={LABEL_CLS}>State</label>
        <select value={state} onChange={(e) => setState(e.target.value)} className={CONTROL_CLS}>
          {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div><label className={LABEL_CLS}>City / District</label><input value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="e.g. Bengaluru Urban" className={CONTROL_CLS} /></div>

      <div className="sm:col-span-2">
        <label className={LABEL_CLS}>Batch Assignment *</label>
        <select value={batchId} onChange={(e) => setBatchId(e.target.value)} className={CONTROL_CLS}>
          <option value="">Select a batch…</option>
          {batches?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        {batches?.length === 0 && <p className="text-[12px] text-[color:var(--text-faint)] mt-1">No batches yet — create one via POST /api/academy/batches first.</p>}
      </div>

      {isMinor && (
        <div className="sm:col-span-2 flex items-start gap-2.5 p-3.5 rounded-lg bg-[rgba(255,138,30,0.1)] border border-[color:var(--accent)]">
          <p className="text-sm">This player is a <b className="text-[color:var(--accent-bright)]">minor</b>. Guardian details are required.</p>
        </div>
      )}
      {isMinor && (
        <>
          <div><label className={LABEL_CLS}>Guardian Name *</label><input value={guardianName} onChange={(e) => setGuardianName(e.target.value)} placeholder="Full name" className={CONTROL_CLS} /></div>
          <div><label className={LABEL_CLS}>Guardian Phone *</label><input value={guardianPhone} onChange={(e) => setGuardianPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit number" className={CONTROL_CLS} /></div>
        </>
      )}

      {error && <p className="sm:col-span-2 text-sm text-[color:var(--bad)]">{error}</p>}
      {added && <p className="sm:col-span-2 text-sm text-[color:var(--ok)] font-semibold flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> Player added.</p>}

      <button type="button" onClick={submit} disabled={busy} className={BTN_AMBER_CLS + ' sm:col-span-2'}>
        {busy ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Add Player'}
      </button>
      <label className="sm:col-span-2 flex items-center gap-2 text-[13px] text-[color:var(--text-dim)]">
        <input type="checkbox" checked={continueAdding} onChange={(e) => setContinueAdding(e.target.checked)} className="accent-[color:var(--accent)]" />
        Continue adding — clear the form and stay on this page instead of leaving
      </label>
    </div>
  )
}

function InviteTab({ academy }: { academy: { id: string; name: string } | null }) {
  const [copied, setCopied] = useState(false)
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const link = academy ? `${baseUrl}/join/${academy.id}` : ''

  function copyLink() {
    if (!link) return
    navigator.clipboard?.writeText(link).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1300)
  }

  const waMessage = academy ? `AthlasX: Join ${academy.name} on AthlasX 🏏 — complete your player profile here: ${link}` : ''

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <div className="bg-[color:var(--canvas)] border border-[color:var(--line)] rounded-lg p-5 flex flex-col gap-3">
        <h3 className="text-[15px] font-extrabold">WhatsApp Invite</h3>
        <p className="text-[13px] text-[color:var(--text-dim)]">Share this link in your academy&apos;s WhatsApp group.</p>
        <div className="font-[family-name:var(--font-mono-jb)] text-[13px] text-[color:var(--accent-bright)] bg-[color:var(--panel-2)] border border-[color:var(--line)] rounded-lg px-3.5 py-3 break-all">{link || '…'}</div>
        <div className="flex gap-2.5 flex-wrap">
          <button type="button" onClick={copyLink} className={BTN_AMBER_CLS}><Copy className="w-3.5 h-3.5 inline mr-1.5" />{copied ? 'Copied ✓' : 'Copy Link'}</button>
          <a href={`https://wa.me/?text=${encodeURIComponent(waMessage)}`} target="_blank" rel="noreferrer"
            className="px-4 py-2.5 rounded-lg border-[1.5px] border-[color:var(--wa)] bg-[color:var(--wa)] text-[#04140c] font-bold text-sm hover:brightness-110 transition-all inline-flex items-center gap-1.5">
            Share via WhatsApp
          </a>
        </div>
        <div className="text-[13px] text-[color:var(--text-dim)] bg-[color:var(--panel-2)] border border-[color:var(--line)] rounded-lg px-3.5 py-3 leading-relaxed">
          <b className="text-[color:var(--text)]">AthlasX:</b> {waMessage || '…'}
        </div>
      </div>
      <div className="bg-[color:var(--canvas)] border border-[color:var(--line)] rounded-lg p-5 flex flex-col items-center gap-3">
        <h3 className="text-[15px] font-extrabold self-start">Join Link QR</h3>
        <div className="w-[190px] h-[190px] bg-[color:var(--panel-2)] border border-[color:var(--line)] rounded-lg flex items-center justify-center text-center p-4">
          <p className="text-[12px] text-[color:var(--text-faint)]">A real scannable QR needs a QR-rendering library, which isn&apos;t a dependency of this project yet — the invite link above works the same way.</p>
        </div>
        <p className="text-[13px] font-bold text-center">Scan to join {academy?.name}</p>
      </div>
      <div className="sm:col-span-2 flex items-start gap-2.5 p-3.5 rounded-lg bg-[rgba(255,138,30,0.08)] border border-[rgba(255,138,30,0.3)]">
        <p className="text-[13px] text-[color:var(--text-dim)] leading-relaxed">Players who join via this link enter an approval queue on the <a href="/academy/join-requests" className="text-[color:var(--accent-bright)] font-bold hover:underline">Join Requests</a> page.</p>
      </div>
    </div>
  )
}
