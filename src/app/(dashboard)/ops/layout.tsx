import { requirePageRole } from '@/lib/require-page-session'

// Every page under /ops is an AthlasX Ops tool, and every API route behind
// them already calls requireRole(['athlasx_ops']). Until this layout existed
// the three page shells gated themselves client-side with useSession(), so any
// signed-in browser mounted the real component before being told "Ops only" —
// the one route group in the app without a server gate. Same notFound()
// posture as every other gated group: to anyone else, /ops doesn't exist.
export default async function OpsLayout({ children }: { children: React.ReactNode }) {
  await requirePageRole(['athlasx_ops'])
  return <>{children}</>
}
