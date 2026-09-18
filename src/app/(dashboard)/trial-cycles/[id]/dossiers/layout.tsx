import { requirePageRole } from '@/lib/require-page-session'

// Registrant dossiers are a selection surface. The parent trial-cycles layout
// only requires a session, because players register for cycles under the same
// route (/trial-cycles/[id]/register) — so the staff-only gate lives here.
export default async function DossiersLayout({ children }: { children: React.ReactNode }) {
  await requirePageRole(['association', 'selection_panel', 'athlasx_ops'])
  return <>{children}</>
}
