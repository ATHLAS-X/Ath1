import { requirePageRole } from '@/lib/require-page-session'

// Mirrors GET/POST /api/ingest's own requireRole allowlist exactly.
export default async function IngestLayout({ children }: { children: React.ReactNode }) {
  await requirePageRole(['association', 'athlasx_ops'])
  return <>{children}</>
}
