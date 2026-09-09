'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { motion } from 'framer-motion'
import {
  LayoutDashboard, User, Users, ClipboardList,
  Shield, BarChart3, Bell, Settings,
  Activity, BookOpen,
  Database, GitMerge, Building2, UserPlus, Inbox, UserCog,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { navSectionsForRole } from '@/lib/chrome'

const ICONS: Record<string, React.ElementType> = {
  '/dashboard': LayoutDashboard,
  '/trial-cycles': ClipboardList,
  '/ingest': Database,
  '/academy-matching': Building2,
  '/selection': Users,
  '/grading': Shield,
  '/convergence': GitMerge,
  '/tracking': Activity,
  '/coach': BookOpen,
  '/profile': User,
  '/record': BarChart3,
  '/notifications': Bell,
  '/settings': Settings,
  '/academy': LayoutDashboard,
  '/academy/players': Users,
  '/academy/batches': ClipboardList,
  '/academy/add-players': UserPlus,
  '/academy/join-requests': Inbox,
  '/ops/associations/new': UserCog,
  '/coach-signups': BookOpen,
}

interface NavItemProps {
  href: string
  icon: React.ElementType
  label: string
  badge?: string
  active: boolean
}

// Same visual weight as the onboarding StepRail's active-step treatment
// (orange ring/fill on the current item) — not the same component, since
// StepRail is a numbered vertical progress rail and this is a flat nav
// list, but the active-state language (orange, not a full-bg fill) is
// deliberately shared.
function NavItem({ href, icon: Icon, label, badge, active }: NavItemProps) {
  return (
    <Link href={href}>
      <motion.div
        whileHover={{ x: active ? 0 : 3 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className={cn(
          'relative flex items-center gap-3 pl-3.5 pr-3 py-2.5 rounded-ax-md text-sm font-medium font-barlow transition-all duration-200 group',
          active
            ? 'bg-[rgba(255,138,30,0.1)] text-ax-accentBright'
            : 'text-ax-textDim hover:text-ax-text hover:bg-white/[0.04]'
        )}
      >
        {active && (
          <motion.div
            layoutId="sidebar-indicator"
            className="absolute left-0 inset-y-2 w-0.5 bg-ax-accent rounded-r-full"
          />
        )}
        <Icon className={cn('w-4 h-4 flex-shrink-0 transition-colors', active ? 'text-ax-accentBright' : 'text-ax-textFaint group-hover:text-ax-textDim')} />
        <span className="flex-1 truncate">{label}</span>
        {badge && (
          <span className={cn(
            'text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center',
            active ? 'bg-[rgba(255,138,30,0.18)] text-ax-accentBright' : 'bg-white/[0.08] text-ax-textFaint'
          )}>
            {badge}
          </span>
        )}
      </motion.div>
    </Link>
  )
}

export default function DashboardSidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const sections = navSectionsForRole(session?.user?.role ?? '')

  return (
    <aside className="hidden lg:flex flex-col w-60 h-screen fixed left-0 top-0 bg-ax-bg border-r border-ax-cardBorder z-30">
      <div className="px-5 h-14 flex items-center border-b border-ax-cardBorder">
        <Link href="/" className="flex items-center gap-1 font-barlow-semi uppercase tracking-[0.18em] font-bold text-sm text-ax-text">
          Athlas<span className="text-ax-accent">X</span>
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-4">
        {sections.map((section) => (
          <div key={section.label}>
            <p className="px-3 font-anton text-[11px] font-normal text-ax-textFaint uppercase tracking-[0.14em] mb-1.5">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavItem
                  key={item.href}
                  href={item.href}
                  icon={ICONS[item.href] ?? User}
                  label={item.label}
                  badge={item.badge}
                  active={pathname === item.href || pathname.startsWith(item.href + '/')}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  )
}
