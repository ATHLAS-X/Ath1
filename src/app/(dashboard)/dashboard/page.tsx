'use client'

import { motion } from 'framer-motion'
import {
  Users, ClipboardList, Activity, FileText,
  ChevronRight, CheckCircle2, Clock, AlertTriangle,
  TrendingUp, Database, Zap, ArrowUpRight,
} from 'lucide-react'
import Link from 'next/link'
import {
  AreaChart, Area, BarChart, Bar, ResponsiveContainer,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'
import AnimatedCounter from '@/components/shared/AnimatedCounter'

/* ─── Mock data ─────────────────────────────────────────────────────────────── */
const registrationTrend = [
  { day: 'Jul 1', count: 120 },
  { day: 'Jul 5', count: 247 },
  { day: 'Jul 10', count: 389 },
  { day: 'Jul 15', count: 512 },
  { day: 'Jul 20', count: 698 },
  { day: 'Jul 25', count: 847 },
]

const scoreDist = [
  { band: '0–40',   count: 89 },
  { band: '41–55',  count: 213 },
  { band: '56–70',  count: 318 },
  { band: '71–85',  count: 167 },
  { band: '86–100', count: 60 },
]

const kpis = [
  { label: 'Registrations',     value: 847,  change: '+124 this week',  up: true,  accent: '#22c55e', icon: Users       },
  { label: 'Dossiers ready',    value: 0,    change: 'Generates at close', up: false, accent: '#3b82f6', icon: FileText    },
  { label: 'Ingest jobs',       value: 2,    change: '2 pending review', up: false, accent: '#f59e0b', icon: Database    },
  { label: 'Form drop alerts',  value: 2,    change: 'Needs attention',  up: false, accent: '#f87171', icon: Activity    },
]

const recentActivity = [
  { text: 'CricHeroes sync completed — 412 rows queued for review', type: 'ingest', time: '2h ago' },
  { text: 'Arjun Sharma flagged: on form · +4 score delta this week', type: 'flag', time: '4h ago' },
  { text: 'Dev Patel: 3 consecutive declining weeks · form_drop', type: 'alert', time: '6h ago' },
  { text: 'UPCA U-16 trial cycle published · registration opens Aug 1', type: 'cycle', time: '1d ago' },
]

const pipeline = [
  { label: 'W1 — Ingest',       href: '/ingest',       done: true,  count: '2 pending review' },
  { label: 'W2 — Identity',     href: '/profile',      done: true,  count: 'Players resolved' },
  { label: 'W3 — Trial Cycles', href: '/trial-cycles', done: true,  count: '1 open · 847 reg.' },
  { label: 'W4 — Grading',      href: '/grading',      done: false, count: '3/5 graded' },
  { label: 'W5 — Tracking',     href: '/tracking',     done: false, count: '2 flags active' },
]

function ChartTip({ active, payload, label }: { active?: boolean; payload?: Array<{value:number;name:string;color:string}>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="glass-dark px-3 py-2.5 rounded-xl text-xs">
      <p className="text-zinc-400 mb-1 font-medium">{label}</p>
      {payload.map(p => (
        <p key={p.name} className="font-bold" style={{ color: p.color }}>{p.name}: {p.value}</p>
      ))}
    </div>
  )
}

function KpiCard({ kpi, delay }: { kpi: typeof kpis[0]; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      className="glass-card p-5 relative overflow-hidden"
    >
      <div className="absolute top-0 inset-x-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${kpi.accent}40, transparent)` }} />
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: `${kpi.accent}12`, border: `1px solid ${kpi.accent}22` }}>
          <kpi.icon className="w-[18px] h-[18px]" style={{ color: kpi.accent }} />
        </div>
        <span className={`text-[10px] font-bold px-2 py-1 rounded-lg border ${kpi.up ? 'text-green-400 bg-green-500/8 border-green-500/15' : 'text-zinc-500 bg-white/[0.03] border-white/[0.06]'}`}>
          {kpi.change}
        </span>
      </div>
      <div className="text-3xl font-black text-white mb-1 tabular-nums">
        <AnimatedCounter to={kpi.value} duration={1.4} />
      </div>
      <div className="text-xs text-zinc-600 font-medium">{kpi.label}</div>
    </motion.div>
  )
}

export default function DashboardPage() {
  return (
    <div className="space-y-5 max-w-[1400px]">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-white">
            Association Overview
          </h1>
          <p className="text-xs text-zinc-600 mt-0.5">UPCA · 2026–27 Season · U-19 trials in progress</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl glass border border-green-500/20">
            <span className="live-dot" />
            <span className="text-xs font-semibold text-green-400">Registration Open</span>
          </div>
          <Link href="/trial-cycles">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-zinc-400 hover:text-white text-xs font-medium transition-colors">
              Manage cycles <ChevronRight className="w-3 h-3" />
            </button>
          </Link>
        </div>
      </motion.div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => <KpiCard key={kpi.label} kpi={kpi} delay={i * 0.07} />)}
      </div>

      {/* W3 pipeline */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">W3 Pipeline · UPCA U-19</p>
          <Link href="/trial-cycles" className="text-[10px] text-green-400 hover:text-green-300 flex items-center gap-1 transition-colors">
            Details <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="space-y-2">
          {pipeline.map((step, i) => (
            <Link key={step.label} href={step.href}>
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.06 }}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.04] transition-colors group"
              >
                <div className={cn('w-6 h-6 rounded-full flex items-center justify-center shrink-0',
                  step.done ? 'bg-green-500/15 border border-green-500/30' : 'bg-white/[0.04] border border-white/[0.08]'
                )}>
                  {step.done
                    ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                    : <Clock className="w-3 h-3 text-zinc-600" />}
                </div>
                <span className={cn('text-xs font-bold flex-1', step.done ? 'text-zinc-300' : 'text-zinc-500')}>{step.label}</span>
                <span className="text-[10px] text-zinc-600">{step.count}</span>
                <ChevronRight className="w-3 h-3 text-zinc-700 group-hover:text-zinc-400 transition-colors" />
              </motion.div>
            </Link>
          ))}
        </div>
      </motion.div>

      {/* Charts */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Registration trend */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="lg:col-span-2 glass-card p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-bold text-white">Registration Trend</h3>
              <p className="text-xs text-zinc-600 mt-0.5">UPCA U-19 2026–27 · Jul 1–25</p>
            </div>
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-green-400" />
              <span className="text-xs font-black text-gradient-green">847 total</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={188}>
            <AreaChart data={registrationTrend} margin={{ top: 0, right: 0, left: -24, bottom: 0 }}>
              <defs>
                <linearGradient id="gReg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.28} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" tick={{ fill: '#3f3f46', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#3f3f46', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTip />} />
              <Area type="monotone" dataKey="count" name="Registrations" stroke="#22c55e" strokeWidth={2} fill="url(#gReg)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Score distribution */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42 }} className="glass-card p-5">
          <h3 className="text-sm font-bold text-white mb-0.5">AthlasX Score Distribution</h3>
          <p className="text-xs text-zinc-600 mb-4">Shortlisted pool · n=847</p>
          <ResponsiveContainer width="100%" height={188}>
            <BarChart data={scoreDist} margin={{ top: 0, right: 0, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
              <XAxis dataKey="band" tick={{ fill: '#3f3f46', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#3f3f46', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTip />} />
              <Bar dataKey="count" name="Players" radius={[4, 4, 0, 0]} fill="#22c55e" fillOpacity={0.7} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Bottom row */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Flags */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.48 }} className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white">Active Flags</h3>
              <p className="text-[11px] text-zinc-600">Weekly tracking alerts</p>
            </div>
            <Link href="/tracking" className="text-[10px] text-green-400 flex items-center gap-1 hover:text-green-300 transition-colors">
              View all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-2.5">
            {[
              { name: 'Dev Patel',   flag: '🔴 Form drop',    detail: '3 consecutive declines · Bowling economy', color: 'text-red-400' },
              { name: 'Vivek Yadav', flag: '🔴 Form drop',    detail: '4 consecutive declines · Wicket rate',    color: 'text-red-400' },
              { name: 'Arjun Sharma',flag: '🟢 On form',      detail: '+4 score delta this week',                color: 'text-green-400' },
              { name: 'Karan Mehta', flag: '🟢 On form',      detail: 'Trending up · last 3 matches',            color: 'text-green-400' },
            ].map((f, i) => (
              <motion.div
                key={f.name}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.52 + i * 0.07 }}
                className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-bold text-white">{f.name}</p>
                    <span className={cn('text-[10px] font-bold', f.color)}>{f.flag}</span>
                  </div>
                  <p className="text-[10px] text-zinc-600 mt-0.5">{f.detail}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Activity feed */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.54 }} className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-sm font-bold text-white">Recent Activity</h3>
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/8 border border-green-500/15">
              <span className="live-dot" />
              <span className="text-[9px] font-bold text-green-400">Live</span>
            </div>
          </div>
          <div className="space-y-3">
            {recentActivity.map((a, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.58 + i * 0.07 }}
                className="flex items-start gap-2.5"
              >
                <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{
                  background: a.type === 'alert' ? '#f87171' : a.type === 'ingest' ? '#3b82f6' : a.type === 'flag' ? '#22c55e' : '#f59e0b'
                }} />
                <div>
                  <p className="text-[11px] text-zinc-400 leading-snug">{a.text}</p>
                  <p className="text-[9px] text-zinc-700 mt-0.5">{a.time}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  )
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}
