import { DashboardSidebar } from '@/components/dashboard/sidebar'
import { DashboardHeader } from '@/components/dashboard/header'

export default function OwnerDashboardLayout({
  children,
  restaurantName,
  userInitials,
}: {
  children: React.ReactNode
  restaurantName: string
  userInitials: string
}) {
  return (
    <div className="min-h-screen bg-background">
      <DashboardSidebar restaurantName={restaurantName} />
      <DashboardHeader restaurantName={restaurantName} userInitials={userInitials} />
      <main className="md:ml-[260px] pt-24 px-4 md:px-8 pb-24 md:pb-8 min-h-screen">
        {children}
      </main>
    </div>
  )
}
