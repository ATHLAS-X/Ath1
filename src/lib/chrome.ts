import type { UserRole } from '@/types'
import { ACADEMY_SELF_SERVE_ENABLED, FRANCHISE_SCOUT_ENABLED } from '@/lib/feature-flags'

export type ChromeNavItem = {
  label: string
  href: string
  badge?: string
}

export type ChromeNavSection = {
  label: string
  roles: UserRole[]
  items: ChromeNavItem[]
}

/** Nav sections that already exist in the dashboard shell, keyed by role. */
export const NAV_SECTIONS: ChromeNavSection[] = [
  {
    label: 'Association',
    roles: ['association', 'athlasx_ops'],
    items: [
      { label: 'Overview', href: '/association' },
      { label: 'Trial Cycles', href: '/trial-cycles', badge: '1 open' },
      { label: 'Ingest & Data', href: '/ingest', badge: '2' },
      { label: 'Identity Exceptions', href: '/identity-exceptions' },
      { label: 'Academy Matching', href: '/academy-matching' },
      { label: 'Coach Signups', href: '/coach-signups' },
    ],
  },
  {
    label: 'Selection',
    roles: ['selection_panel', 'athlasx_ops'],
    items: [
      { label: 'Candidate Pool', href: '/selection' },
      { label: 'Grading', href: '/grading' },
      { label: 'Convergence', href: '/convergence' },
    ],
  },
  {
    label: 'Season',
    roles: ['coach', 'athlasx_ops'],
    items: [
      { label: 'Weekly Tracking', href: '/tracking', badge: '2 flags' },
      { label: 'Coach', href: '/coach' },
    ],
  },
  {
    label: 'Player',
    roles: ['player', 'athlasx_ops'],
    items: [
      { label: 'My Profile', href: '/profile' },
      { label: 'My Record', href: '/record' },
    ],
  },
  {
    label: 'Ops Tools',
    roles: ['athlasx_ops'],
    items: [
      { label: 'Create Association', href: '/ops/associations/new' },
      { label: 'Pending Associations', href: '/ops/associations/pending' },
      { label: 'Pending Scouts', href: '/ops/scouts/pending' },
    ],
  },
  {
    label: 'Academy',
    roles: ['academy_admin', 'athlasx_ops'],
    items: [
      { label: 'Dashboard', href: '/academy' },
      { label: 'Players', href: '/academy/players' },
      { label: 'Batches', href: '/academy/batches' },
      { label: 'Add Players', href: '/academy/add-players' },
      { label: 'Join Requests', href: '/academy/join-requests' },
    ],
  },
  {
    label: 'Scout',
    roles: ['scout', 'athlasx_ops'],
    items: [
      { label: 'Candidate Pool', href: '/scout' },
    ],
  },
  {
    label: 'Account',
    roles: ['player', 'selection_panel', 'coach', 'association', 'athlasx_ops', 'academy_admin', 'scout'],
    items: [
      // No `badge` — was a hardcoded '3' shown to every role regardless of
      // real state. There's no Notification model anywhere in the schema
      // to compute a real unread count from (confirmed via grep), so
      // showing nothing is the honest state until one exists, not a
      // fabricated number. /notifications itself already handles "nothing
      // to show" correctly (see that page's own empty-state copy) — this
      // just stops the sidebar from promising something the page doesn't
      // back up.
      { label: 'Notifications', href: '/notifications' },
      { label: 'Settings', href: '/settings' },
    ],
  },
]

export function navSectionsForRole(role: string): ChromeNavSection[] {
  return NAV_SECTIONS.filter((section) => section.roles.includes(role as UserRole))
    // The Academy nav section is part of the self-serve academy-admin
    // surface flagged off by default — see feature-flags.ts.
    .filter((section) => section.label !== 'Academy' || ACADEMY_SELF_SERVE_ENABLED)
    // Scout dashboard is data-safety-gated the same way — see
    // FRANCHISE_SCOUT_ENABLED's own comment and scout/layout.tsx.
    .filter((section) => section.label !== 'Scout' || FRANCHISE_SCOUT_ENABLED)
}

export function navHrefsForRole(role: string): string[] {
  return navSectionsForRole(role).flatMap((section) => section.items.map((item) => item.href))
}

/** Top bar's page title/breadcrumb — the matching nav item's own label for
 *  the current pathname (longest-href match, so a sub-route like
 *  /academy/players/123 still resolves to "Players", not the nearest
 *  section-less fallback). Derived from the same navSectionsForRole data,
 *  not a second mapping to keep in sync. */
export function pageTitleForPath(role: string, pathname: string): string {
  const items = navSectionsForRole(role).flatMap((section) => section.items)
  const match = items
    .filter((item) => pathname === item.href || pathname.startsWith(item.href + '/'))
    .sort((a, b) => b.href.length - a.href.length)[0]
  return match?.label ?? 'Dashboard'
}

/** Each role's own home page — where a signed-in visit to / should land. */
const ROLE_HOME: Record<string, string> = {
  player: '/record',
  coach: '/coach',
  association: '/association',
  athlasx_ops: '/dashboard',
  selection_panel: '/selection',
  academy_admin: '/academy',
  scout: '/scout',
}

export function rootDestination(session: { user?: { id?: string; role?: string } } | null): string {
  if (!session?.user?.id) return '/auth'
  return ROLE_HOME[session.user.role ?? ''] ?? '/dashboard'
}

const ROLE_LABELS: Record<string, string> = {
  player: 'Player',
  selection_panel: 'Selection',
  coach: 'Coach',
  association: 'Association',
  athlasx_ops: 'AthlasX Ops',
  academy_admin: 'Academy Admin',
  scout: 'Scout',
}

export function chromeIdentity(user?: { email?: string | null; role?: string } | null): {
  email: string
  roleLabel: string
} {
  return {
    email: user?.email ?? '',
    roleLabel: ROLE_LABELS[user?.role ?? ''] ?? '',
  }
}
