import type { UserRole } from '@/types'

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
      { label: 'Overview', href: '/dashboard' },
      { label: 'Trial Cycles', href: '/trial-cycles', badge: '1 open' },
      { label: 'Ingest & Data', href: '/ingest', badge: '2' },
      { label: 'Academy Matching', href: '/academy-matching' },
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
    label: 'Account',
    roles: ['player', 'selection_panel', 'coach', 'association', 'athlasx_ops'],
    items: [
      { label: 'Notifications', href: '/notifications', badge: '3' },
      { label: 'Settings', href: '/settings' },
    ],
  },
]

export function navSectionsForRole(role: string): ChromeNavSection[] {
  return NAV_SECTIONS.filter((section) => section.roles.includes(role as UserRole))
}

export function navHrefsForRole(role: string): string[] {
  return navSectionsForRole(role).flatMap((section) => section.items.map((item) => item.href))
}

export function rootDestination(session: { user?: { id?: string } } | null): string {
  if (session?.user?.id) return '/dashboard'
  return '/api/auth/signin?callbackUrl=/dashboard'
}

const ROLE_LABELS: Record<string, string> = {
  player: 'Player',
  selection_panel: 'Selection',
  coach: 'Coach',
  association: 'Association',
  athlasx_ops: 'AthlasX Ops',
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
