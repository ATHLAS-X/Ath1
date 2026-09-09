import { requirePageRole } from '@/lib/require-page-session'

// Mirrors GET /api/dashboard's own requireRole allowlist exactly.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requirePageRole(['association', 'selection_panel', 'coach', 'athlasx_ops'])
  return <>{children}</>
}
