/*
 * Route-level skeleton for /association — same rationale as
 * coach/loading.tsx: covers server-segment render time (real
 * getServerSession() work in association/layout.tsx's pending-
 * verification gate), not a replacement for association/page.tsx's own
 * per-section loading spinners, which stay exactly as they were.
 *
 * Shape mirrors the real page (hero + 5 stat tiles + KPI row + 3
 * section cards) so the skeleton doesn't visibly jump when real content
 * swaps in.
 */
function Tile() {
  return <div className="h-[104px] rounded-ax-md border border-ax-cardBorder bg-ax-bgSoft animate-pulse" />
}

export default function AssociationLoading() {
  return (
    <div className="space-y-6 max-w-[1300px] font-barlow">
      <div className="space-y-2">
        <div className="h-3 w-40 rounded-ax-sm bg-ax-bgSoft animate-pulse" />
        <div className="h-7 w-64 rounded-ax-sm bg-ax-bgSoft animate-pulse" />
      </div>

      <div className="h-[132px] rounded-ax-lg border border-ax-cardBorder bg-ax-bgSoft animate-pulse" />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Tile /><Tile /><Tile /><Tile /><Tile />
      </div>

      <div className="grid lg:grid-cols-[1.6fr_1fr] gap-4">
        <div className="h-[120px] rounded-ax-lg border border-ax-cardBorder bg-ax-bgSoft animate-pulse" />
        <div className="h-[120px] rounded-ax-lg border border-ax-cardBorder bg-ax-bgSoft animate-pulse" />
      </div>

      <div className="h-[220px] rounded-ax-lg border border-ax-cardBorder bg-ax-bgSoft animate-pulse" />
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="h-[260px] rounded-ax-lg border border-ax-cardBorder bg-ax-bgSoft animate-pulse" />
        <div className="h-[260px] rounded-ax-lg border border-ax-cardBorder bg-ax-bgSoft animate-pulse" />
      </div>
    </div>
  )
}
