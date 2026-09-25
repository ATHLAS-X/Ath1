import DashboardSidebar from '@/components/layout/DashboardSidebar'
import DashboardTopBar from '@/components/layout/DashboardTopBar'
import PageTransition from '@/components/layout/PageTransition'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-ax-bg">
      <DashboardSidebar />
      <DashboardTopBar />
      <main className="p-6 pt-8 lg:pl-[280px] lg:pr-8 lg:pt-10">
        <PageTransition>{children}</PageTransition>
      </main>
    </div>
  )
}
