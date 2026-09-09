import { requirePageSession } from '@/lib/require-page-session'

// Covers /trial-cycles, /trial-cycles/[id]/register, and
// /trial-cycles/[id]/dossiers (layouts cascade to nested routes). Every
// API route these pages call (trial-cycles, trial-cycles/[id]/register,
// trial-cycles/[id]/registrations/[id]/dossier) only requires requireAuth
// and scopes data to the caller's own identity/role server-side — any
// authenticated session, not a specific role.
export default async function TrialCyclesLayout({ children }: { children: React.ReactNode }) {
  await requirePageSession()
  return <>{children}</>
}
