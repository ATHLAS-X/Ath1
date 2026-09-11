/*
 * Route-level skeleton for /coach — covers the window between navigating
 * here and coach/layout.tsx's own async getServerSession() resolving
 * (Next.js's real use case for loading.tsx: server-segment render time,
 * not the client-side fetch that follows). coach/page.tsx's own
 * useState/useEffect spinner still covers that later window once the
 * client component mounts and calls GET /api/coach/squad — this
 * supplements it, doesn't replace it, per the task's own instruction not
 * to touch existing manual handling.
 *
 * Shape mirrors the real page's layout (hero + 4 stat tiles + KPI row +
 * table) so the skeleton doesn't visibly jump when real content swaps in.
 */
function Tile() {
  return <div className="h-[104px] rounded-ax-md border border-ax-cardBorder bg-ax-bgSoft animate-pulse" />
}

export default function CoachLoading() {
  return (
    <div className="space-y-6 max-w-[1300px] font-barlow">
      <div className="space-y-2">
        <div className="h-3 w-32 rounded-ax-sm bg-ax-bgSoft animate-pulse" />
        <div className="h-7 w-56 rounded-ax-sm bg-ax-bgSoft animate-pulse" />
      </div>

      <div className="h-[132px] rounded-ax-lg border border-ax-cardBorder bg-ax-bgSoft animate-pulse" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Tile /><Tile /><Tile /><Tile />
      </div>

      <div className="grid lg:grid-cols-[1.6fr_1fr] gap-4">
        <div className="h-[120px] rounded-ax-lg border border-ax-cardBorder bg-ax-bgSoft animate-pulse" />
        <div className="h-[120px] rounded-ax-lg border border-ax-cardBorder bg-ax-bgSoft animate-pulse" />
      </div>

      <div className="h-[320px] rounded-ax-lg border border-ax-cardBorder bg-ax-bgSoft animate-pulse" />
    </div>
  )
}
