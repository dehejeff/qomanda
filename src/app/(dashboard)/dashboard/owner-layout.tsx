import { DashboardSidebar } from '@/components/dashboard/sidebar'
import { DashboardHeader } from '@/components/dashboard/header'
import { DashboardNotificationBanner } from '@/components/dashboard/dashboard-notification-banner'
import { DashboardSearchProvider } from '@/components/dashboard/dashboard-search-context'

export default function OwnerDashboardLayout({
  children,
  restaurantId,
  restaurantName,
  userInitials,
  operationalMode = 'both',
  role = 'owner',
}: {
  children: React.ReactNode
  restaurantId: string
  restaurantName: string
  userInitials: string
  operationalMode?: 'dine_in' | 'counter' | 'both'
  role?: string
}) {
  return (
    <DashboardSearchProvider>
      <div className="min-h-screen bg-background">
        <DashboardSidebar restaurantName={restaurantName} operationalMode={operationalMode} role={role} />
        <DashboardHeader restaurantId={restaurantId} restaurantName={restaurantName} userInitials={userInitials} />
        <main className="md:ml-[260px] pt-24 px-4 md:px-8 pb-24 md:pb-8 min-h-screen">
          <DashboardNotificationBanner />
          {children}
        </main>
      </div>
    </DashboardSearchProvider>
  )
}
