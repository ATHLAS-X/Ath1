import { requirePageSession } from '@/lib/require-page-session'

// Covers /trial-cycles, /trial-cycles/[id]/register, and
// /trial-cycles/[id]/dossiers (layouts cascade to nested routes).
//
// Deliberately session-only at this level: /trial-cycles/[id]/register is
// where PLAYERS register for a cycle (notifications link them there), so a
// staff role gate here would lock them out. The two staff surfaces gate
// themselves one level down instead — page.tsx for the cycle list and
// creation wizard, and [id]/dossiers/layout.tsx for registrant dossiers.
export default async function TrialCyclesLayout({ children }: { children: React.ReactNode }) {
  await requirePageSession()
  return <>{children}</>
}
