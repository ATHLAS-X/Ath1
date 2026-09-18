import { requirePageRole } from '@/lib/require-page-session'
import TrialCyclesClient from './TrialCyclesClient'

// The cycle list and "New Trial Cycle" wizard. Gated here rather than in
// trial-cycles/layout.tsx, because that layout also covers the player-facing
// /trial-cycles/[id]/register. The allowlist is every role with an in-app link
// to this page: the Association nav, /association, and /dashboard — whose own
// allowlist includes coach and selection_panel.
export default async function TrialCyclesPage() {
  await requirePageRole(['association', 'selection_panel', 'coach', 'athlasx_ops'])
  return <TrialCyclesClient />
}
