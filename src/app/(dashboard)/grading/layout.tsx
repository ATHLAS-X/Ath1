import { requirePageRole } from '@/lib/require-page-session'

// Mirrors GET /api/grading/session's own requireRole allowlist exactly.
export default async function GradingLayout({ children }: { children: React.ReactNode }) {
  await requirePageRole(['selection_panel', 'association', 'athlasx_ops'])
  return <>{children}</>
}
