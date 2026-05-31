import { InternalSidebar } from '@/components/internal/sidebar'
import { getStaffSession, isInternalDevBypass } from '@/lib/staff-auth'
import { redirect } from 'next/navigation'

export default async function InternalLayout({ children }: { children: React.ReactNode }) {
  const session = await getStaffSession()
  if (!session) redirect('/internal/login')

  const staffEmail = session.user.email ?? (isInternalDevBypass() ? 'dev@qomanda.local' : 'staff')

  return (
    <div className="min-h-screen bg-background">
      <InternalSidebar staffEmail={staffEmail} />
      <main className="md:ml-[260px] px-4 md:px-8 py-8 min-h-screen">
        {children}
      </main>
    </div>
  )
}
