import { requirePageRole } from '@/lib/require-page-session'

// The Season nav section lists this page for coach and athlasx_ops, but
// /dashboard's "View all" on Active Flags also links here — and /dashboard is
// open to association and selection_panel too. Gating tighter than that
// allowlist would turn a working in-app link into a 404, so this mirrors it.
export default async function TrackingLayout({ children }: { children: React.ReactNode }) {
  await requirePageRole(['coach', 'association', 'selection_panel', 'athlasx_ops'])
  return <>{children}</>
}
