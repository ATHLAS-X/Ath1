import { requirePageRole } from '@/lib/require-page-session'

// Reached from the Selection nav section (selection_panel, athlasx_ops) and
// as selection_panel's home page (ROLE_HOME in src/lib/chrome.ts). Association
// is included to match the sibling /grading and /convergence gates, which
// association staff already use.
export default async function SelectionLayout({ children }: { children: React.ReactNode }) {
  await requirePageRole(['selection_panel', 'association', 'athlasx_ops'])
  return <>{children}</>
}
