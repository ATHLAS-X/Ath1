'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Users, Activity, FileText,
  ChevronRight, CheckCircle2, Clock, Database, Loader2,
  TrendingUp, TrendingDown,
} from 'lucide-react'
import Link from 'next/link'
import {
  AreaChart, Area, BarChart, Bar, ResponsiveContainer,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'
import AnimatedCounter from '@/components/shared/AnimatedCounter'
import { Button } from '@/components/ui/button'
import { fetchJSON } from '@/lib/fetch-json'

interface DashboardData {
  kpis: { registrations: number; dossiersReady: number; pendingIngest: number; formDropAlerts: number }
  pipeline: { label: string; href: string; done: boolean; count: string }[]
  registrationTrend: { day: string; count: number }[]
  scoreDist: { band: string; count: number }[]
  activeFlags: { name: string; flag: string; detail: string }[]
  activity: { text: string; type: string; time: string }[]
}

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

function KpiCard({ label, value, sub, accent, icon: Icon, delay }: {
  label: string; value: number; sub: string; accent: string; icon: React.ElementType; delay: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      className="glass-card p-5 relative overflow-hidden"
    >
      <div className="absolute top-0 inset-x-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${accent}40, transparent)` }} />
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: `${accent}12`, border: `1px solid ${accent}22` }}>
          <Icon className="w-[18px] h-[18px]" style={{ color: accent }} />
        </div>
        <span className="text-[10px] font-bold px-2 py-1 rounded-lg border text-zinc-500 bg-white/[0.03] border-white/[0.06]">
          {sub}
        </span>
      </div>
      <div className="text-3xl font-black text-white mb-1 tabular-nums">
        <AnimatedCounter to={value} duration={1.4} />
      </div>
      <div className="text-xs text-zinc-600 font-medium">{label}</div>
    </motion.div>
  )
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchJSON<DashboardData>('/api/dashboard')
      .then(setData)
      .catch(err => console.error('Failed to load dashboard data:', err))
      .finally(() => setLoading(false))
  }, [])

  if (loading || !data) {
    return <div className="glass-card p-10 flex items-center justify-center text-zinc-600"><Loader2 className="w-5 h-5 animate-spin" /></div>
  }

  const kpis = [
    { label: 'Registrations',    value: data.kpis.registrations, sub: 'Total',                icon: Users,    accent: '#22c55e' },
    { label: 'Dossiers ready',   value: data.kpis.dossiersReady, sub: 'Generates at close',    icon: FileText, accent: '#3b82f6' },
    { label: 'Ingest jobs',      value: data.kpis.pendingIngest, sub: `${data.kpis.pendingIngest} pending review`, icon: Database, accent: '#f59e0b' },
    { label: 'Form drop alerts', value: data.kpis.formDropAlerts, sub: 'Needs attention',       icon: Activity, accent: '#f87171' },
  ]

  return (
    <div className="space-y-5 max-w-[1400px]">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-anton uppercase text-xl text-ax-text text-balance">Association Overview</h1>
          <p className="text-xs text-zinc-600 mt-0.5">2026–27 Season</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl glass border border-green-500/20">
            <span className="live-dot" />
            <span className="text-xs font-semibold text-green-400">Registration Open</span>
          </div>
          <Link href="/trial-cycles">
            <Button variant="outline" size="sm" className="gap-1.5 rounded-xl text-zinc-400 hover:text-white">
              Manage cycles <ChevronRight className="w-3 h-3" />
            </Button>
          </Link>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => <KpiCard key={kpi.label} {...kpi} delay={i * 0.07} />)}
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">W3 Pipeline</p>
          <Link href="/trial-cycles" className="text-[10px] text-green-400 hover:text-green-300 flex items-center gap-1 transition-colors">
            Details <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="space-y-2">
          {data.pipeline.map((step, i) => (
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
                  {step.done ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> : <Clock className="w-3 h-3 text-zinc-600" />}
                </div>
                <span className={cn('text-xs font-bold flex-1', step.done ? 'text-zinc-300' : 'text-zinc-500')}>{step.label}</span>
                <span className="text-[10px] text-zinc-600">{step.count}</span>
                <ChevronRight className="w-3 h-3 text-zinc-700 group-hover:text-zinc-400 transition-colors" />
              </motion.div>
            </Link>
          ))}
        </div>
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="lg:col-span-2 glass-card p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-bold text-white">Registration Trend</h3>
              <p className="text-xs text-zinc-600 mt-0.5">Cumulative registrations</p>
            </div>
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-green-400" />
              <span className="text-xs font-black text-gradient-green">{data.kpis.registrations} total</span>
            </div>
          </div>
          {data.registrationTrend.length === 0 ? (
            <div className="h-[188px] flex items-center justify-center text-xs text-zinc-700">No registrations yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={188}>
              <AreaChart data={data.registrationTrend} margin={{ top: 0, right: 0, left: -24, bottom: 0 }}>
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
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42 }} className="glass-card p-5">
          <h3 className="text-sm font-bold text-white mb-0.5">AthlasX Score Distribution</h3>
          <p className="text-xs text-zinc-600 mb-4">Candidate pool</p>
          <ResponsiveContainer width="100%" height={188}>
            <BarChart data={data.scoreDist} margin={{ top: 0, right: 0, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
              <XAxis dataKey="band" tick={{ fill: '#3f3f46', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#3f3f46', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTip />} />
              <Bar dataKey="count" name="Players" radius={[4, 4, 0, 0]} fill="#22c55e" fillOpacity={0.7} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
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
            {data.activeFlags.length === 0 ? (
              <p className="text-xs text-zinc-700 text-center py-4">No active flags</p>
            ) : data.activeFlags.map((f, i) => (
              <motion.div
                key={f.name + i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.52 + i * 0.07 }}
                className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-bold text-white">{f.name}</p>
                    <span className={cn('inline-flex items-center gap-1 text-[10px] font-bold', f.flag === 'form_drop' ? 'text-red-400' : 'text-green-400')}>
                      {f.flag === 'form_drop' ? <TrendingDown className="w-3 h-3" strokeWidth={2.5} /> : <TrendingUp className="w-3 h-3" strokeWidth={2.5} />}
                      {f.flag === 'form_drop' ? 'Form drop' : 'On form'}
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-600 mt-0.5">{f.detail}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.54 }} className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-sm font-bold text-white">Recent Activity</h3>
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/8 border border-green-500/15">
              <span className="live-dot" />
              <span className="text-[9px] font-bold text-green-400">Live</span>
            </div>
          </div>
          <div className="space-y-3">
            {data.activity.length === 0 ? (
              <p className="text-xs text-zinc-700 text-center py-4">No recent activity</p>
            ) : data.activity.map((a, i) => (
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
