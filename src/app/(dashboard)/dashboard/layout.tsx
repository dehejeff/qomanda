import { DashboardSidebar } from '@/components/dashboard/sidebar'
import { DashboardHeader } from '@/components/dashboard/header'
import { DEV_BYPASS, mockRestaurant } from '@/lib/dev-mock'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardInnerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  let restaurantName = 'Restaurante'
  let userInitials = 'R'

  if (DEV_BYPASS) {
    restaurantName = mockRestaurant.name
    userInitials = mockRestaurant.name.charAt(0).toUpperCase()
  } else {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('name')
      .eq('owner_id', user.id)
      .single()

    if (!restaurant) redirect('/login')

    restaurantName = restaurant.name
    userInitials = restaurant.name.charAt(0).toUpperCase()
  }

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
