'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { CustomerBottomNav } from '@/components/customer/bottom-nav'
import { PaymentReceiptList } from '@/components/payment-receipt-list'
import type { PaymentReceiptRecord, ReceiptContext } from '@/lib/payment-receipt'
import { formatCurrency } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { popNav } from '@/lib/nav-history'

export default function ReceiptsPage() {
  const params = useParams<{ slug: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const sessionId = searchParams.get('session')

  function goBack() {
    const prev = popNav()
    router.push(prev ?? `/${params.slug}/orders${sessionId ? `?session=${sessionId}` : ''}`)
  }

  const [payments, setPayments] = useState<PaymentReceiptRecord[]>([])
  const [context, setContext] = useState<ReceiptContext>({ restaurantName: '', tableNumber: '—' })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!sessionId) {
      router.replace(`/${params.slug}`)
      return
    }

    fetch(`/api/customer/payments?session=${sessionId}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error)
        setPayments(data.payments ?? [])
        setContext(data.context ?? { restaurantName: '', tableNumber: '—' })
        setLoading(false)
      })
      .catch(() => {
        toast.error('Erro ao carregar recibos.')
        setLoading(false)
      })
  }, [sessionId, params.slug, router])

  const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0D1117' }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#00E676' }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-24" style={{ background: '#0D1117', color: '#FFFFFF' }}>
      <header
        className="sticky top-0 z-40 flex justify-between items-center px-6 h-16"
        style={{ background: 'rgba(13,17,23,0.9)', borderBottom: '1px solid rgba(88,66,55,0.35)', backdropFilter: 'blur(12px)' }}
      >
        <button onClick={goBack} className="p-2 -ml-2 rounded-full" style={{ color: '#00E676' }}>
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-base font-semibold" style={{ fontFamily: 'Geist, sans-serif' }}>Meus Recibos</h1>
        <div className="w-8" />
      </header>

      <main className="px-6 pt-6 space-y-5 relative z-10">
        <div
          className="rounded-xl p-5 flex justify-between items-center"
          style={{ background: '#161B22', border: '1px solid #30363D' }}
        >
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: '#8B949E' }}>
              {context.restaurantName}
            </p>
            <p className="text-lg font-bold" style={{ fontFamily: 'Geist, sans-serif' }}>
              Mesa {context.tableNumber}
            </p>
          </div>
          {payments.length > 0 && (
            <div className="text-right">
              <p className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: '#8B949E' }}>
                Total pago
              </p>
              <p className="text-xl font-black" style={{ color: '#34d399', fontFamily: 'Geist, sans-serif' }}>
                {formatCurrency(totalPaid)}
              </p>
            </div>
          )}
        </div>

        {payments.length === 0 ? (
          <div className="py-16 text-center">
            <span className="material-symbols-outlined text-[48px] block mb-3" style={{ color: '#30363D' }}>
              receipt_long
            </span>
            <p className="text-sm font-semibold" style={{ color: '#FFFFFF' }}>Você não realizou pagamentos</p>
            <p className="text-xs mt-2 max-w-[240px] mx-auto leading-relaxed" style={{ color: '#8B949E' }}>
              Seus recibos e códigos de confirmação aparecerão aqui após o pagamento.
            </p>
            <Link
              href={`/${params.slug}/checkout?session=${sessionId}`}
              className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95"
              style={{ background: '#00E676', color: '#003319' }}
            >
              Ir para pagamento
            </Link>
          </div>
        ) : (
          <>
            <PaymentReceiptList
              payments={payments}
              context={context}
              variant="customer"
              title="Histórico desta visita"
            />
            <p className="text-xs text-center leading-relaxed px-4 pb-2" style={{ color: '#30363D' }}>
              Guarde os códigos para reembolso ou comprovação. Eles também foram enviados ao seu WhatsApp.
            </p>
          </>
        )}
      </main>

      <CustomerBottomNav slug={params.slug} sessionId={sessionId ?? ''} />
    </div>
  )
}
