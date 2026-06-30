'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { HubBottomNav } from '@/components/customer/hub-bottom-nav'
import { HubPageHeader } from '@/components/customer/hub-chrome'
import { SavedCardsSection } from '@/components/customer/saved-cards-section'
import { CustomerPinSettings } from '@/components/customer/customer-pin-settings'
import type { HubActiveSession } from '@/app/api/customer/hub/route'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { formatWhatsAppDisplay } from '@/lib/customer-form'
import { HubSessionGate } from '@/components/customer/hub-session-gate'
import { clearCustomerAuth, customerAuthFetch } from '@/lib/customer-auth'

function HubProfileContent() {
  const router = useRouter()
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [activeSession, setActiveSession] = useState<HubActiveSession | null>(null)

  useEffect(() => {
    const cid = localStorage.getItem('kicomanda_customer_id')
    if (!cid) {
      router.replace('/login?perfil=cliente')
      return
    }
    setCustomerId(cid)

    const sessionId = localStorage.getItem('kicomanda_session_id')
    const qs = new URLSearchParams({ customer: cid })
    if (sessionId) qs.set('session', sessionId)

    customerAuthFetch(`/api/customer/hub?${qs}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error)
        setFirstName(data.customer.firstName)
        setLastName(data.customer.lastName)
        setWhatsapp(data.customer.whatsapp)
        setActiveSession(data.activeSession ?? null)
        if (data.activeSession) {
          localStorage.setItem('kicomanda_session_id', data.activeSession.sessionId)
        }
        setLoading(false)
      })
      .catch(() => {
        toast.error('Erro ao carregar perfil.')
        setLoading(false)
      })
  }, [router])

  function handleLogout() {
    clearCustomerAuth()
    sessionStorage.clear()
    toast.success('Sessão encerrada.')
    router.push('/login?perfil=cliente')
  }

  if (loading || !customerId) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0D1117' }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#00E676' }} />
      </div>
    )
  }

  return (
    <HubSessionGate customerId={customerId}>
    <div className="min-h-screen pb-24" style={{ background: '#0D1117', color: '#FFFFFF' }}>
      <HubPageHeader title="Perfil" backHref="/hub" />
      <main className="px-5 pt-6 space-y-5 max-w-lg mx-auto">
        <section className="rounded-xl p-5 space-y-3" style={{ background: '#161B22', border: '1px solid #30363D' }}>
          <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#8B949E' }}>Meu perfil</p>
          <div>
            <p className="text-lg font-bold">{firstName} {lastName}</p>
            <p className="text-sm mt-0.5" style={{ color: '#8B949E' }}>{formatWhatsAppDisplay(whatsapp)}</p>
          </div>
          {activeSession && (
            <>
              <Link href={`/${activeSession.slug}/home?session=${activeSession.sessionId}`}
                className="flex items-center justify-between px-4 py-3 rounded-xl transition-all active:scale-[0.98]"
                style={{ background: '#21262D', border: '1px solid #30363D' }}>
                <span className="text-sm">Visita em andamento · Mesa {activeSession.tableNumber}</span>
                <span className="material-symbols-outlined text-[18px]" style={{ color: '#30363D' }}>chevron_right</span>
              </Link>
              <Link href={`/${activeSession.slug}/profile?session=${activeSession.sessionId}`}
                className="flex items-center justify-between px-4 py-3 rounded-xl transition-all active:scale-[0.98]"
                style={{ background: '#21262D', border: '1px solid #30363D' }}>
                <span className="text-sm">Preferências e fidelidade</span>
                <span className="material-symbols-outlined text-[18px]" style={{ color: '#30363D' }}>chevron_right</span>
              </Link>
            </>
          )}
        </section>

        <CustomerPinSettings customerId={customerId} />
        <SavedCardsSection customerId={customerId} />

        <button type="button" onClick={handleLogout}
          className="w-full h-11 flex items-center justify-center gap-2 rounded-xl text-sm font-mono transition-all active:scale-[0.98]"
          style={{ background: 'transparent', border: '1px solid #30363D', color: '#8B949E' }}>
          <span className="material-symbols-outlined text-[18px]">logout</span>
          Sair deste aparelho
        </button>
      </main>
      <Suspense fallback={null}><HubBottomNav active="profile" /></Suspense>
    </div>
    </HubSessionGate>
  )
}

export default function HubProfilePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0D1117' }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#00E676' }} />
      </div>
    }>
      <HubProfileContent />
    </Suspense>
  )
}
