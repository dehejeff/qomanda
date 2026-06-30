'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { KiComandaLogo } from '@/components/kicomanda-logo'
import { HubBottomNav } from '@/components/customer/hub-bottom-nav'
import type { HubActiveSession, HubReceiptSummary, HubVisit } from '@/app/api/customer/hub/route'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { HubSessionGate } from '@/components/customer/hub-session-gate'
import { customerAuthFetch } from '@/lib/customer-auth'

type HubData = {
  customer: { firstName: string; lastName: string; whatsapp: string }
  visits: HubVisit[]
  favorites: { restaurantId: string; slug: string; name: string; logoUrl: string | null }[]
  receiptSummary: HubReceiptSummary
  hasPin: boolean
  activeSession: HubActiveSession | null
}

function formatVisitDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function RestaurantAvatar({ name, logoUrl, size = 44 }: { name: string; logoUrl: string | null; size?: number }) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={logoUrl} alt={name} className="rounded-xl object-cover shrink-0"
        style={{ width: size, height: size, border: '1px solid #30363D' }} />
    )
  }
  return (
    <div className="rounded-xl flex items-center justify-center shrink-0 font-bold"
      style={{ width: size, height: size, background: '#21262D', border: '1px solid #30363D', color: '#00E676', fontSize: size * 0.35 }}>
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

export default function CustomerHubPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0D1117' }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#00E676' }} />
      </div>
    }>
      <CustomerHubContent />
    </Suspense>
  )
}

function CustomerHubContent() {
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    setCustomerId(localStorage.getItem('kicomanda_customer_id'))
    setInitialized(true)
  }, [])

  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0D1117' }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#00E676' }} />
      </div>
    )
  }

  if (!customerId) {
    return <HubGuestView />
  }

  return (
    <HubSessionGate customerId={customerId}>
      <HubAuthenticatedView customerId={customerId} />
    </HubSessionGate>
  )
}

function HubGuestView() {
  return (
    <div className="min-h-screen pb-24" style={{ background: '#0D1117', color: '#FFFFFF' }}>
      <header className="sticky top-0 z-40 px-6 h-16 flex items-center justify-between"
        style={{ background: 'rgba(13,17,23,0.92)', borderBottom: '1px solid rgba(88,66,55,0.35)', backdropFilter: 'blur(12px)' }}>
        <div className="flex items-center gap-2.5">
          <KiComandaLogo size={28} />
          <span className="font-black text-base" style={{ fontFamily: 'Geist, sans-serif', letterSpacing: '-0.02em' }}>KiComanda</span>
        </div>
      </header>
      <main className="px-5 pt-6 space-y-6 max-w-lg mx-auto">
        <section className="rounded-2xl p-6 relative overflow-hidden"
          style={{ background: '#21262D', border: '1px solid #30363D' }}>
          <p className="text-[10px] font-mono uppercase tracking-widest mb-2" style={{ color: '#8B949E' }}>Check-in na mesa</p>
          <h1 className="text-xl font-black mb-2" style={{ fontFamily: 'Geist, sans-serif' }}>Comece escaneando a mesa</h1>
          <p className="text-sm leading-relaxed mb-5" style={{ color: '#e0c0b1' }}>
            Na primeira visita você informa nome e WhatsApp. Depois, o check-in fica automático.
          </p>
          <Link href="/scan"
            className="flex items-center justify-center gap-2 w-full h-12 rounded-xl font-bold text-sm transition-all active:scale-[0.98]"
            style={{ background: '#00E676', color: '#003319', boxShadow: '0 8px 24px rgba(0,230,118,0.25)' }}>
            <span className="material-symbols-outlined text-[20px]">qr_code_scanner</span>
            Escanear QR Code
          </Link>
        </section>
        <section className="rounded-xl p-6 text-center space-y-4" style={{ background: '#161B22', border: '1px solid #30363D' }}>
          <span className="material-symbols-outlined text-[40px] block" style={{ color: '#30363D' }}>person_add</span>
          <p className="text-sm font-semibold">Ainda não tem conta?</p>
          <p className="text-xs leading-relaxed max-w-[280px] mx-auto" style={{ color: '#8B949E' }}>
            Cadastre-se para ver histórico, recibos e cartões. Ou escaneie o QR da mesa na primeira visita ao restaurante.
          </p>
          <div className="flex flex-col gap-2">
            <Link href="/cadastro?tipo=cliente"
              className="inline-flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-bold transition-all active:scale-[0.98]"
              style={{ background: '#00E676', color: '#003319' }}>
              Criar conta
            </Link>
            <Link href="/login?perfil=cliente"
              className="inline-flex items-center justify-center gap-2 h-10 rounded-xl text-xs font-mono transition-all active:scale-[0.98]"
              style={{ border: '1px solid #30363D', color: '#8B949E' }}>
              Entrar na minha conta
            </Link>
          </div>
        </section>
      </main>
      <Suspense fallback={null}><HubBottomNav /></Suspense>
    </div>
  )
}

function HubAuthenticatedView({ customerId }: { customerId: string }) {
  const [data, setData] = useState<HubData | null>(null)
  const [loading, setLoading] = useState(true)
  const [togglingFav, setTogglingFav] = useState<string | null>(null)

  const loadHub = useCallback(async () => {
    setLoading(true)
    const sessionId = localStorage.getItem('kicomanda_session_id')
    const qs = new URLSearchParams({ customer: customerId })
    if (sessionId) qs.set('session', sessionId)

    const res = await customerAuthFetch(`/api/customer/hub?${qs}`)
    if (!res.ok) throw new Error('Erro ao carregar')
    const hub = await res.json() as HubData
    setData(hub)
    if (hub.activeSession) {
      localStorage.setItem('kicomanda_session_id', hub.activeSession.sessionId)
    }
    setLoading(false)
  }, [customerId])

  useEffect(() => {
    loadHub().catch(() => {
      toast.error('Erro ao carregar seus dados.')
      setLoading(false)
    })
  }, [loadHub])

  async function toggleFavorite(restaurantId: string, isFavorite: boolean) {
    setTogglingFav(restaurantId)
    try {
      if (isFavorite) {
        await fetch(`/api/customer/favorites?customer=${customerId}&restaurant=${restaurantId}`, { method: 'DELETE' })
      } else {
        await fetch('/api/customer/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customerId, restaurantId }),
        })
      }
      setData(prev => {
        if (!prev) return prev
        const visits = prev.visits.map(v =>
          v.restaurantId === restaurantId ? { ...v, isFavorite: !isFavorite } : v,
        )
        let favorites = [...prev.favorites]
        const visit = visits.find(v => v.restaurantId === restaurantId)
        if (!isFavorite && visit) {
          favorites = [{ restaurantId: visit.restaurantId, slug: visit.slug, name: visit.name, logoUrl: visit.logoUrl }, ...favorites]
        } else {
          favorites = favorites.filter(f => f.restaurantId !== restaurantId)
        }
        return { ...prev, visits, favorites }
      })
    } catch {
      toast.error('Erro ao atualizar favorito.')
    } finally {
      setTogglingFav(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0D1117' }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#00E676' }} />
      </div>
    )
  }

  const firstName = data?.customer.firstName ?? ''
  const greeting  = firstName ? `Olá, ${firstName}` : 'Bem-vindo'

  return (
    <div className="min-h-screen pb-24" style={{ background: '#0D1117', color: '#FFFFFF' }}>
      <header className="sticky top-0 z-40 px-6 h-16 flex items-center justify-between"
        style={{ background: 'rgba(13,17,23,0.92)', borderBottom: '1px solid rgba(88,66,55,0.35)', backdropFilter: 'blur(12px)' }}>
        <div className="flex items-center gap-2.5">
          <KiComandaLogo size={28} />
          <span className="font-black text-base" style={{ fontFamily: 'Geist, sans-serif', letterSpacing: '-0.02em' }}>KiComanda</span>
        </div>
        <span className="text-xs font-mono truncate max-w-[140px]" style={{ color: '#8B949E' }}>{greeting}</span>
      </header>

      <main className="px-5 pt-6 space-y-6 max-w-lg mx-auto">
        <section className="rounded-2xl p-6 relative overflow-hidden"
          style={{ background: '#21262D', border: '1px solid #30363D' }}>
          <p className="text-[10px] font-mono uppercase tracking-widest mb-2" style={{ color: '#8B949E' }}>Check-in na mesa</p>
          <h1 className="text-xl font-black mb-2" style={{ fontFamily: 'Geist, sans-serif' }}>Escaneie o QR da mesa</h1>
          <p className="text-sm leading-relaxed mb-5" style={{ color: '#e0c0b1' }}>
            Aponte a câmera para o QR Code e entre no cardápio em segundos.
          </p>
          <Link href="/scan"
            className="flex items-center justify-center gap-2 w-full h-12 rounded-xl font-bold text-sm transition-all active:scale-[0.98]"
            style={{ background: '#00E676', color: '#003319', boxShadow: '0 8px 24px rgba(0,230,118,0.25)' }}>
            <span className="material-symbols-outlined text-[20px]">qr_code_scanner</span>
            Escanear QR Code
          </Link>
        </section>

        {data?.activeSession && (
          <Link href={`/${data.activeSession.slug}/home?session=${data.activeSession.sessionId}`}
            className="block rounded-xl p-4 transition-all active:scale-[0.98]"
            style={{ background: 'rgba(0,230,118,0.1)', border: '1px solid rgba(0,230,118,0.35)' }}>
            <div className="flex items-center gap-3">
              <RestaurantAvatar name={data.activeSession.restaurantName} logoUrl={data.activeSession.logoUrl} />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#00E676' }}>Visita em andamento</p>
                <p className="text-sm font-bold truncate">{data.activeSession.restaurantName}</p>
                <p className="text-xs" style={{ color: '#8B949E' }}>Mesa {data.activeSession.tableNumber}</p>
              </div>
              <span className="material-symbols-outlined" style={{ color: '#00E676' }}>arrow_forward</span>
            </div>
          </Link>
        )}

        <section>
          <div className="flex items-center justify-between mb-3 px-1">
            <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#8B949E' }}>Favoritos</p>
            {(data?.favorites.length ?? 0) > 0 && (
              <span className="text-[10px] font-mono" style={{ color: '#30363D' }}>{data!.favorites.length} salvo{data!.favorites.length !== 1 ? 's' : ''}</span>
            )}
          </div>
          {(data?.favorites.length ?? 0) === 0 ? (
            <div className="rounded-xl p-5 text-center" style={{ background: '#161B22', border: '1px solid #30363D' }}>
              <span className="material-symbols-outlined text-[32px] block mb-2" style={{ color: '#30363D' }}>star</span>
              <p className="text-sm" style={{ color: '#8B949E' }}>Favorite restaurantes do histórico para check-in mais rápido.</p>
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
              {data!.favorites.map(fav => (
                <Link key={fav.restaurantId} href={`/${fav.slug}`}
                  className="flex flex-col items-center gap-2 shrink-0 w-[88px] p-3 rounded-xl transition-all active:scale-95"
                  style={{ background: '#161B22', border: '1px solid #30363D' }}>
                  <RestaurantAvatar name={fav.name} logoUrl={fav.logoUrl} size={48} />
                  <span className="text-[11px] font-semibold text-center line-clamp-2 leading-tight">{fav.name}</span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section id="visits">
          <p className="text-[10px] font-mono uppercase tracking-widest mb-3 px-1" style={{ color: '#8B949E' }}>Onde você já foi</p>
          {(data?.visits.length ?? 0) === 0 ? (
            <div className="rounded-xl p-8 text-center" style={{ background: '#161B22', border: '1px solid #30363D' }}>
              <span className="material-symbols-outlined text-[40px] block mb-3" style={{ color: '#30363D' }}>storefront</span>
              <p className="text-sm font-semibold">Nenhuma visita ainda</p>
              <p className="text-xs mt-2 leading-relaxed max-w-[240px] mx-auto" style={{ color: '#8B949E' }}>
                Escaneie o QR de um restaurante parceiro para começar.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {data!.visits.map(visit => (
                <div key={visit.restaurantId} className="rounded-xl p-4 flex items-center gap-3"
                  style={{ background: '#161B22', border: '1px solid #30363D' }}>
                  <Link href={`/${visit.slug}`} className="flex items-center gap-3 flex-1 min-w-0">
                    <RestaurantAvatar name={visit.name} logoUrl={visit.logoUrl} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{visit.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#8B949E' }}>
                        {visit.visitCount} visita{visit.visitCount !== 1 ? 's' : ''} · {formatVisitDate(visit.lastVisitAt)}
                      </p>
                    </div>
                  </Link>
                  <button type="button" disabled={togglingFav === visit.restaurantId}
                    onClick={() => toggleFavorite(visit.restaurantId, visit.isFavorite)}
                    className="p-2 rounded-full transition-all active:scale-90 shrink-0"
                    aria-label={visit.isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}>
                    <span className="material-symbols-outlined text-[22px]"
                      style={{ color: visit.isFavorite ? '#00E676' : '#30363D', fontVariationSettings: visit.isFavorite ? "'FILL' 1" : undefined }}>
                      star
                    </span>
                  </button>
                  <Link href={`/${visit.slug}`} className="p-2 rounded-full shrink-0" style={{ color: '#30363D' }} aria-label="Ir para restaurante">
                    <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="grid grid-cols-2 gap-3">
          <Link href="/hub/receipts"
            className="rounded-xl p-4 flex flex-col gap-2 transition-all active:scale-[0.98]"
            style={{ background: '#161B22', border: '1px solid #30363D' }}>
            <span className="material-symbols-outlined text-[24px]" style={{ color: '#00E676' }}>receipt_long</span>
            <p className="text-sm font-semibold">Recibos</p>
            <p className="text-[11px] font-mono" style={{ color: '#30363D' }}>
              {(data?.receiptSummary.totalReceipts ?? 0) > 0
                ? `${data!.receiptSummary.totalReceipts} em ${data!.receiptSummary.restaurantCount} restaurante(s)`
                : 'Nenhum ainda'}
            </p>
          </Link>
          <Link href="/hub/profile"
            className="rounded-xl p-4 flex flex-col gap-2 transition-all active:scale-[0.98]"
            style={{ background: '#161B22', border: '1px solid #30363D' }}>
            <span className="material-symbols-outlined text-[24px]" style={{ color: '#00E676' }}>person</span>
            <p className="text-sm font-semibold">Perfil</p>
            <p className="text-[11px] font-mono" style={{ color: '#30363D' }}>
              {data?.hasPin ? 'Conta protegida' : 'Cartões e PIN'}
            </p>
          </Link>
        </section>
      </main>

      <Suspense fallback={null}><HubBottomNav /></Suspense>
    </div>
  )
}
