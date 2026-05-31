'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { QomandaLogo } from '@/components/qomanda-logo'
import { HubBottomNav } from '@/components/customer/hub-bottom-nav'
import { SavedCardsSection } from '@/components/customer/saved-cards-section'
import { PaymentReceiptCard } from '@/components/payment-receipt-card'
import type { HubActiveSession, HubReceipt, HubVisit } from '@/app/api/customer/hub/route'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

type HubData = {
  customer: { firstName: string; lastName: string; whatsapp: string }
  visits: HubVisit[]
  favorites: { restaurantId: string; slug: string; name: string; logoUrl: string | null }[]
  receipts: HubReceipt[]
  activeSession: HubActiveSession | null
}

function formatWhatsApp(digits: string) {
  const d = digits.replace(/\D/g, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  return digits
}

function formatVisitDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function RestaurantAvatar({ name, logoUrl, size = 44 }: { name: string; logoUrl: string | null; size?: number }) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={logoUrl} alt={name} className="rounded-xl object-cover shrink-0"
        style={{ width: size, height: size, border: '1px solid #334155' }} />
    )
  }
  return (
    <div className="rounded-xl flex items-center justify-center shrink-0 font-bold"
      style={{ width: size, height: size, background: '#1e293b', border: '1px solid #334155', color: '#ffb690', fontSize: size * 0.35 }}>
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

export default function CustomerHubPage() {
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [data, setData] = useState<HubData | null>(null)
  const [loading, setLoading] = useState(true)
  const [togglingFav, setTogglingFav] = useState<string | null>(null)

  const loadHub = useCallback(async (cid: string) => {
    const sessionId = localStorage.getItem('qomanda_session_id')
    const qs = new URLSearchParams({ customer: cid })
    if (sessionId) qs.set('session', sessionId)

    const res = await fetch(`/api/customer/hub?${qs}`)
    if (!res.ok) throw new Error('Erro ao carregar')
    const hub = await res.json() as HubData
    setData(hub)
    setLoading(false)
  }, [])

  useEffect(() => {
    const cid = localStorage.getItem('qomanda_customer_id')
    setCustomerId(cid)
    if (cid) {
      loadHub(cid).catch(() => {
        toast.error('Erro ao carregar seus dados.')
        setLoading(false)
      })
    } else {
      setLoading(false)
    }
  }, [loadHub])

  async function toggleFavorite(restaurantId: string, isFavorite: boolean) {
    if (!customerId) return
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

  const router = useRouter()

  function handleLogout() {
    localStorage.clear()
    sessionStorage.clear()
    toast.success('Sessão encerrada.')
    router.push('/login?perfil=cliente')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0b1326' }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#f97316' }} />
      </div>
    )
  }

  const firstName = data?.customer.firstName ?? ''
  const greeting  = firstName ? `Olá, ${firstName}` : 'Bem-vindo'

  return (
    <div className="min-h-screen pb-24" style={{ background: '#0b1326', color: '#dae2fd' }}>
      <header className="sticky top-0 z-40 px-6 h-16 flex items-center justify-between"
        style={{ background: 'rgba(11,19,38,0.92)', borderBottom: '1px solid rgba(88,66,55,0.35)', backdropFilter: 'blur(12px)' }}>
        <div className="flex items-center gap-2.5">
          <QomandaLogo size={28} />
          <span className="font-black text-base" style={{ fontFamily: 'Geist, sans-serif', letterSpacing: '-0.02em' }}>Qomanda</span>
        </div>
        {customerId && (
          <span className="text-xs font-mono truncate max-w-[140px]" style={{ color: '#a78b7d' }}>{greeting}</span>
        )}
      </header>

      <main className="px-5 pt-6 space-y-6 max-w-lg mx-auto">

        {/* Scan CTA */}
        <section className="rounded-2xl p-6 relative overflow-hidden"
          style={{ background: 'linear-gradient(145deg,#1e293b,#0f172a)', border: '1px solid #334155' }}>
          <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full pointer-events-none"
            style={{ background: 'rgba(249,115,22,0.08)', filter: 'blur(24px)' }} />
          <p className="text-[10px] font-mono uppercase tracking-widest mb-2" style={{ color: '#a78b7d' }}>
            Check-in na mesa
          </p>
          <h1 className="text-xl font-black mb-2" style={{ fontFamily: 'Geist, sans-serif' }}>
            {customerId ? 'Escaneie o QR da mesa' : 'Comece escaneando a mesa'}
          </h1>
          <p className="text-sm leading-relaxed mb-5" style={{ color: '#e0c0b1' }}>
            {customerId
              ? 'Aponte a câmera para o QR Code e entre no cardápio em segundos.'
              : 'Na primeira visita você informa nome e WhatsApp. Depois, o check-in fica automático.'}
          </p>
          <Link href="/scan"
            className="flex items-center justify-center gap-2 w-full h-12 rounded-xl font-bold text-sm transition-all active:scale-[0.98]"
            style={{ background: '#f97316', color: '#582200', boxShadow: '0 8px 24px rgba(249,115,22,0.25)' }}>
            <span className="material-symbols-outlined text-[20px]">qr_code_scanner</span>
            Escanear QR Code
          </Link>
        </section>

        {/* Sessão ativa */}
        {data?.activeSession && (
          <Link href={`/${data.activeSession.slug}/home?session=${data.activeSession.sessionId}`}
            className="block rounded-xl p-4 transition-all active:scale-[0.98]"
            style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.35)' }}>
            <div className="flex items-center gap-3">
              <RestaurantAvatar name={data.activeSession.restaurantName} logoUrl={data.activeSession.logoUrl} />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#ffb690' }}>Visita em andamento</p>
                <p className="text-sm font-bold truncate">{data.activeSession.restaurantName}</p>
                <p className="text-xs" style={{ color: '#a78b7d' }}>Mesa {data.activeSession.tableNumber}</p>
              </div>
              <span className="material-symbols-outlined" style={{ color: '#f97316' }}>arrow_forward</span>
            </div>
          </Link>
        )}

        {/* Favoritos */}
        {customerId && (
          <section>
            <div className="flex items-center justify-between mb-3 px-1">
              <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#a78b7d' }}>Favoritos</p>
              {(data?.favorites.length ?? 0) > 0 && (
                <span className="text-[10px] font-mono" style={{ color: '#584237' }}>{data!.favorites.length} salvo{data!.favorites.length !== 1 ? 's' : ''}</span>
              )}
            </div>
            {(data?.favorites.length ?? 0) === 0 ? (
              <div className="rounded-xl p-5 text-center" style={{ background: '#131b2e', border: '1px solid #334155' }}>
                <span className="material-symbols-outlined text-[32px] block mb-2" style={{ color: '#584237' }}>star</span>
                <p className="text-sm" style={{ color: '#a78b7d' }}>Favorite restaurantes do histórico para check-in mais rápido.</p>
              </div>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
                {data!.favorites.map(fav => (
                  <Link key={fav.restaurantId} href={`/${fav.slug}`}
                    className="flex flex-col items-center gap-2 shrink-0 w-[88px] p-3 rounded-xl transition-all active:scale-95"
                    style={{ background: '#131b2e', border: '1px solid #334155' }}>
                    <RestaurantAvatar name={fav.name} logoUrl={fav.logoUrl} size={48} />
                    <span className="text-[11px] font-semibold text-center line-clamp-2 leading-tight">{fav.name}</span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Histórico de visitas */}
        {customerId && (
          <section id="visits">
            <p className="text-[10px] font-mono uppercase tracking-widest mb-3 px-1" style={{ color: '#a78b7d' }}>
              Onde você já foi
            </p>
            {(data?.visits.length ?? 0) === 0 ? (
              <div className="rounded-xl p-8 text-center" style={{ background: '#131b2e', border: '1px solid #334155' }}>
                <span className="material-symbols-outlined text-[40px] block mb-3" style={{ color: '#584237' }}>storefront</span>
                <p className="text-sm font-semibold">Nenhuma visita ainda</p>
                <p className="text-xs mt-2 leading-relaxed max-w-[240px] mx-auto" style={{ color: '#a78b7d' }}>
                  Escaneie o QR de um restaurante parceiro para começar.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {data!.visits.map(visit => (
                  <div key={visit.restaurantId} className="rounded-xl p-4 flex items-center gap-3"
                    style={{ background: '#131b2e', border: '1px solid #334155' }}>
                    <Link href={`/${visit.slug}`} className="flex items-center gap-3 flex-1 min-w-0">
                      <RestaurantAvatar name={visit.name} logoUrl={visit.logoUrl} />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{visit.name}</p>
                        <p className="text-xs mt-0.5" style={{ color: '#a78b7d' }}>
                          {visit.visitCount} visita{visit.visitCount !== 1 ? 's' : ''} · {formatVisitDate(visit.lastVisitAt)}
                        </p>
                      </div>
                    </Link>
                    <button
                      type="button"
                      disabled={togglingFav === visit.restaurantId}
                      onClick={() => toggleFavorite(visit.restaurantId, visit.isFavorite)}
                      className="p-2 rounded-full transition-all active:scale-90 shrink-0"
                      aria-label={visit.isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                    >
                      <span className="material-symbols-outlined text-[22px]"
                        style={{
                          color: visit.isFavorite ? '#f97316' : '#584237',
                          fontVariationSettings: visit.isFavorite ? "'FILL' 1" : undefined,
                        }}>
                        star
                      </span>
                    </button>
                    <Link href={`/${visit.slug}`}
                      className="p-2 rounded-full shrink-0" style={{ color: '#584237' }}
                      aria-label="Ir para restaurante">
                      <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Recibos e NF-e */}
        {customerId && (
          <section id="receipts">
            <div className="mb-3 px-1">
              <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#a78b7d' }}>
                Recibos e notas fiscais
              </p>
              <p className="text-xs mt-1" style={{ color: '#584237' }}>
                Comprovantes de pagamento · NF-e enviada ao WhatsApp quando disponível
              </p>
            </div>
            {(data?.receipts.length ?? 0) === 0 ? (
              <div className="rounded-xl p-8 text-center" style={{ background: '#131b2e', border: '1px solid #334155' }}>
                <span className="material-symbols-outlined text-[40px] block mb-3" style={{ color: '#584237' }}>receipt_long</span>
                <p className="text-sm font-semibold">Nenhum recibo ainda</p>
                <p className="text-xs mt-2 leading-relaxed max-w-[260px] mx-auto" style={{ color: '#a78b7d' }}>
                  Após pagar pela Qomanda, seus comprovantes aparecem aqui.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {data!.receipts.map(r => (
                  <div key={r.id}>
                    <p className="text-[10px] font-mono uppercase tracking-widest mb-1.5 px-1" style={{ color: '#584237' }}>
                      {r.restaurantName} · Mesa {r.tableNumber}
                    </p>
                    <PaymentReceiptCard
                      payment={r}
                      context={{ restaurantName: r.restaurantName, tableNumber: r.tableNumber }}
                      variant="customer"
                      compact
                    />
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Meus cartões */}
        {customerId && <SavedCardsSection customerId={customerId} />}

        {/* Perfil resumido */}
        {customerId && data?.customer && (
          <section id="profile" className="rounded-xl p-5 space-y-4"
            style={{ background: '#131b2e', border: '1px solid #334155' }}>
            <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: '#a78b7d' }}>Meu perfil</p>
            <div>
              <p className="text-base font-bold">{data.customer.firstName} {data.customer.lastName}</p>
              <p className="text-sm mt-0.5" style={{ color: '#a78b7d' }}>{formatWhatsApp(data.customer.whatsapp)}</p>
            </div>
            {data.activeSession && (
              <Link href={`/${data.activeSession.slug}/profile?session=${data.activeSession.sessionId}`}
                className="flex items-center justify-between px-4 py-3 rounded-xl transition-all active:scale-[0.98]"
                style={{ background: '#1e293b', border: '1px solid #334155' }}>
                <span className="text-sm">Preferências e fidelidade</span>
                <span className="material-symbols-outlined text-[18px]" style={{ color: '#584237' }}>chevron_right</span>
              </Link>
            )}
            <button type="button" onClick={handleLogout}
              className="w-full h-11 flex items-center justify-center gap-2 rounded-xl text-sm font-mono transition-all active:scale-[0.98]"
              style={{ background: 'transparent', border: '1px solid #584237', color: '#a78b7d' }}>
              <span className="material-symbols-outlined text-[18px]">logout</span>
              Limpar dados deste aparelho
            </button>
          </section>
        )}

        {!customerId && (
          <section className="rounded-xl p-6 text-center space-y-4" style={{ background: '#131b2e', border: '1px solid #334155' }}>
            <span className="material-symbols-outlined text-[40px] block" style={{ color: '#584237' }}>person_add</span>
            <p className="text-sm font-semibold">Ainda não tem conta?</p>
            <p className="text-xs leading-relaxed max-w-[280px] mx-auto" style={{ color: '#a78b7d' }}>
              Cadastre-se para ver histórico, recibos e cartões. Ou escaneie o QR da mesa na primeira visita ao restaurante.
            </p>
            <div className="flex flex-col gap-2">
              <Link href="/cadastro?tipo=cliente"
                className="inline-flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-bold transition-all active:scale-[0.98]"
                style={{ background: '#f97316', color: '#582200' }}>
                Criar conta
              </Link>
              <Link href="/scan"
                className="inline-flex items-center justify-center gap-2 h-10 rounded-xl text-xs font-mono transition-all active:scale-[0.98]"
                style={{ border: '1px solid #584237', color: '#a78b7d' }}>
                Escanear mesa
              </Link>
            </div>
          </section>
        )}
      </main>

      <HubBottomNav active="home" />
    </div>
  )
}
