import DashboardSidebar from '@/components/layout/DashboardSidebar'
import DashboardTopBar from '@/components/layout/DashboardTopBar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-ax-bg">
      <DashboardSidebar />
      <DashboardTopBar />
      <main className="lg:pl-60 p-6">{children}</main>
    </div>
  )
}
