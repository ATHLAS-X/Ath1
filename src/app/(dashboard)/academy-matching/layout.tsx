import { requirePageRole } from '@/lib/require-page-session'

// Mirrors the Association nav section that lists this page (src/lib/chrome.ts)
// — nothing else in the app links here. The /api/academy-matching/* routes
// behind it still only call requireAuth: tightening those is B4 in the
// hardening backlog, deferred until after the OAuth work, so for now this
// gate is page-shell defense-in-depth rather than the real enforcement.
export default async function AcademyMatchingLayout({ children }: { children: React.ReactNode }) {
  await requirePageRole(['association', 'athlasx_ops'])
  return <>{children}</>
}
