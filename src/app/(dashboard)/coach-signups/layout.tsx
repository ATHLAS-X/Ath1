import { requirePageRole } from '@/lib/require-page-session'

// Mirrors GET /api/association/coaches's own requireRole allowlist exactly.
export default async function CoachSignupsLayout({ children }: { children: React.ReactNode }) {
  await requirePageRole(['association', 'athlasx_ops'])
  return <>{children}</>
}
