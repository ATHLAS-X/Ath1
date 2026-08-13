import DashboardSidebar from '@/components/layout/DashboardSidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#050505]">
      <DashboardSidebar />
      <main className="lg:pl-60 p-6">{children}</main>
    </div>
  )
}
