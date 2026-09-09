import { requirePageRole } from '@/lib/require-page-session'

// Mirrors GET /api/identity-exceptions's own requireRole allowlist exactly.
export default async function IdentityExceptionsLayout({ children }: { children: React.ReactNode }) {
  await requirePageRole(['association', 'athlasx_ops'])
  return <>{children}</>
}
