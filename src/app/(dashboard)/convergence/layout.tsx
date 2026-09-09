import { requirePageRole } from '@/lib/require-page-session'

// Mirrors GET /api/grading/session's own requireRole allowlist exactly
// (this page also calls into the grading session API).
export default async function ConvergenceLayout({ children }: { children: React.ReactNode }) {
  await requirePageRole(['selection_panel', 'association', 'athlasx_ops'])
  return <>{children}</>
}
