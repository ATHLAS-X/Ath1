'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  LayoutDashboard, User, Users, ClipboardList,
  Shield, BarChart3, Bell, Settings, Zap,
  ChevronRight, LogOut, Activity, BookOpen,
  Database, GitMerge,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Navigation sections — one per platform role
// In production these are filtered by the authenticated user's role.
// For the beta demo all sections are visible for walkthrough purposes.

const sections = [
  {
    label: 'Association',
    items: [
      { label: 'Overview',       href: '/dashboard',      icon: LayoutDashboard },
      { label: 'Trial Cycles',   href: '/trial-cycles',   icon: ClipboardList,  badge: '1 open' },
      { label: 'Ingest & Data',  href: '/ingest',         icon: Database, badge: '2' },
    ],
  },
  {
    label: 'Selection',
    items: [
      { label: 'Candidate Pool', href: '/selection',      icon: Users },
      { label: 'Grading',        href: '/grading',        icon: Shield },
      { label: 'Convergence',    href: '/convergence',    icon: GitMerge },
    ],
  },
  {
    label: 'Season',
    items: [
      { label: 'Weekly Tracking',href: '/tracking',       icon: Activity,       badge: '2 flags' },
      { label: 'Coach',          href: '/coach',          icon: BookOpen },
    ],
  },
  {
    label: 'Player',
    items: [
      { label: 'My Profile',     href: '/profile',        icon: User },
      { label: 'My Record',      href: '/record',         icon: BarChart3  },
    ],
  },
  {
    label: 'Account',
    items: [
      { label: 'Notifications',  href: '/notifications',  icon: Bell,           badge: '3' },
      { label: 'Settings',       href: '/settings',       icon: Settings },
    ],
  },
]

interface NavItemProps {
  href: string
  icon: React.ElementType
  label: string
  badge?: string
  active: boolean
}

function NavItem({ href, icon: Icon, label, badge, active }: NavItemProps) {
  return (
    <Link href={href}>
      <motion.div
        whileHover={{ x: active ? 0 : 3 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className={cn(
          'relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group',
          active
            ? 'bg-green-500/10 text-green-400 border border-green-500/18'
            : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04]'
        )}
      >
        {active && (
          <motion.div
            layoutId="sidebar-indicator"
            className="absolute left-0 inset-y-2 w-0.5 bg-green-500 rounded-r-full"
          />
        )}
        <Icon className={cn('w-4 h-4 flex-shrink-0 transition-colors', active ? 'text-green-400' : 'text-zinc-600 group-hover:text-zinc-400')} />
        <span className="flex-1 truncate">{label}</span>
        {badge && (
          <span className={cn(
            'text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center',
            active ? 'bg-green-500/20 text-green-300' : 'bg-white/8 text-zinc-500'
          )}>
            {badge}
          </span>
        )}
        {active && <ChevronRight className="w-3 h-3 text-green-500 flex-shrink-0" />}
      </motion.div>
    </Link>
  )
}

export default function DashboardSidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden lg:flex flex-col w-60 h-screen fixed left-0 top-0 bg-[#070707] border-r border-white/[0.05] z-30">
      {/* Logo */}
      <div className="px-5 h-16 flex items-center border-b border-white/[0.05]">
        <Link href="/" className="flex items-center gap-2.5 group">
          <motion.div
            whileHover={{ rotate: 15, scale: 1.1 }}
            transition={{ type: 'spring', stiffness: 400 }}
            className="w-8 h-8 rounded-xl bg-gradient-to-br from-green-400 to-emerald-700 flex items-center justify-center glow-green-sm"
          >
            <Zap className="w-[15px] h-[15px] text-white fill-white" />
          </motion.div>
          <span className="text-[1.2rem] font-black tracking-tight">
            Athlas<span className="text-gradient-green">X</span>
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-4">
        {sections.map((section) => (
          <div key={section.label}>
            <p className="px-3 text-[10px] font-bold text-zinc-700 uppercase tracking-[0.14em] mb-1.5">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavItem
                  key={item.href}
                  {...item}
                  active={pathname === item.href || pathname.startsWith(item.href + '/')}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* User row */}
      <div className="px-3 pb-4 border-t border-white/[0.05] pt-3">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.04] transition-colors cursor-pointer group">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-green-500 to-emerald-700 flex items-center justify-center flex-shrink-0 text-xs font-black text-white">
            HG
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-white truncate">Hritvik Garg</p>
            <p className="text-[10px] text-zinc-600 truncate">AthlasX Ops</p>
          </div>
          <LogOut className="w-3.5 h-3.5 text-zinc-700 group-hover:text-zinc-400 transition-colors flex-shrink-0" />
        </div>
      </div>
    </aside>
  )
}
