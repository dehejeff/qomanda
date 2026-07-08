'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { resolveWaiterRestaurantId } from '@/lib/waiter-restaurant-id'
import { formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'

type PaidPayment = {
  id: string
  amount: number
  created_at: string
  customerName: string
  locationLabel: string
  nfeSent: boolean
}

const SCANNER_ID = 'garcom-nfe-qr-reader'

function formatLocation(tableNumber: string | null | undefined): string {
  if (!tableNumber) return 'Mesa'
  if (tableNumber.toUpperCase() === 'BALCAO') return 'Balcão'
  return `Mesa ${tableNumber}`
}

/**
 * Envio da nota fiscal por WhatsApp: lista os pagamentos confirmados de hoje;
 * o garçom escaneia o QR do DANFE impresso (ou cola a chave) e o cliente
 * recebe o link da nota no WhatsApp.
 */
export function WaiterNfeSend() {
  const [payments, setPayments] = useState<PaidPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [activePayment, setActivePayment] = useState<PaidPayment | null>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    const rid = await resolveWaiterRestaurantId(supabase)
    setRestaurantId(rid)
    if (!rid) {
      setPayments([])
      setLoading(false)
      return
    }

    const dayStart = new Date()
    dayStart.setHours(0, 0, 0, 0)

    const { data } = await supabase
      .from('payments')
      .select(`
        id, amount, created_at, method,
        customer:customers(first_name, last_name),
        session:sessions(table:tables(number))
      `)
      .eq('restaurant_id', rid)
      .eq('status', 'paid')
      .neq('method', 'offer')
      .not('customer_id', 'is', null)
      .gte('created_at', dayStart.toISOString())
      .order('created_at', { ascending: false })
      .limit(30)

    const rows = (data ?? []).map((p: Record<string, unknown>) => {
      const customerRaw = p.customer
      const customer = Array.isArray(customerRaw) ? customerRaw[0] : customerRaw
      const sessionRaw = p.session
      const session = Array.isArray(sessionRaw) ? sessionRaw[0] : sessionRaw
      const tableRaw = (session as { table?: unknown })?.table
      const table = Array.isArray(tableRaw) ? tableRaw[0] : tableRaw
      const c = customer as { first_name?: string; last_name?: string } | null
      return {
        id: String(p.id),
        amount: Number(p.amount),
        created_at: String(p.created_at),
        customerName: c ? `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() : 'Cliente',
        locationLabel: formatLocation((table as { number?: string })?.number),
        nfeSent: false,
      }
    })

    // Marca quem já recebeu a nota — via API (RLS de nfe_invoices é owner-only)
    if (rows.length > 0) {
      try {
        const res = await fetch(`/api/garcom/nfe-whatsapp?paymentIds=${rows.map(r => r.id).join(',')}`)
        if (res.ok) {
          const data = await res.json() as { sentPaymentIds?: string[] }
          const sentIds = new Set(data.sentPaymentIds ?? [])
          for (const row of rows) row.nfeSent = sentIds.has(row.id)
        }
      } catch { /* badge é informativo; falha não bloqueia a lista */ }
    }

    setPayments(rows)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!restaurantId) return
    const supabase = createClient()
    const ch = supabase
      .channel(`garcom-nfe-${restaurantId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'payments',
        filter: `restaurant_id=eq.${restaurantId}`,
      }, () => { load() })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load, restaurantId])

  if (loading) return null

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-black" style={{ letterSpacing: '-0.02em' }}>Enviar nota fiscal</h2>
        <p className="text-xs mt-0.5 font-mono" style={{ color: '#8B949E' }}>
          Escaneie o QR da nota impressa e o cliente recebe no WhatsApp
        </p>
      </div>

      {payments.length === 0 ? (
        <div className="rounded-2xl py-10 text-center"
          style={{ background: '#161B22', border: '1px solid #30363D' }}>
          <span className="material-symbols-outlined text-[36px] mb-1" style={{ color: '#30363D' }}>
            receipt_long
          </span>
          <p className="text-sm font-mono" style={{ color: '#8B949E' }}>
            Nenhum pagamento confirmado hoje
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {payments.map(p => {
            const time = new Date(p.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
            return (
              <li key={p.id}
                className="rounded-2xl p-3.5 flex items-center gap-3"
                style={{ background: '#161B22', border: '1px solid #30363D' }}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold truncate">{p.customerName}</p>
                  <p className="text-[11px] font-mono mt-0.5" style={{ color: '#8B949E' }}>
                    {p.locationLabel} · {time} · {formatCurrency(p.amount)}
                  </p>
                </div>
                {p.nfeSent ? (
                  <span className="shrink-0 flex items-center gap-1 text-[11px] font-mono font-bold px-2.5 py-1.5 rounded-lg"
                    style={{ background: 'rgba(0,230,118,0.12)', color: '#00E676' }}>
                    <span className="material-symbols-outlined text-[14px]">check</span>
                    NF enviada
                  </span>
                ) : (
                  <button type="button"
                    onClick={() => setActivePayment(p)}
                    className="shrink-0 flex items-center gap-1.5 h-10 px-3.5 rounded-xl font-bold font-mono text-xs active:scale-95 transition-transform"
                    style={{ background: 'rgba(0,230,118,0.15)', color: '#00E676', border: '1px solid rgba(0,230,118,0.4)' }}>
                    <span className="material-symbols-outlined text-[18px]">qr_code_scanner</span>
                    Enviar NF
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {activePayment && (
        <NfeScanModal
          payment={activePayment}
          onClose={() => setActivePayment(null)}
          onSent={() => { setActivePayment(null); void load() }}
        />
      )}
    </section>
  )
}

function NfeScanModal({ payment, onClose, onSent }: {
  payment: PaidPayment
  onClose: () => void
  onSent: () => void
}) {
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const submittingRef = useRef(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [manualKey, setManualKey] = useState('')
  const [sending, setSending] = useState(false)
  const [cameraDenied, setCameraDenied] = useState(false)

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current
    scannerRef.current = null
    if (!scanner) return
    try {
      if (scanner.isScanning) await scanner.stop()
      scanner.clear()
    } catch { /* ignore cleanup errors */ }
  }, [])

  const submit = useCallback(async (qrContent: string) => {
    if (submittingRef.current) return
    submittingRef.current = true
    setSending(true)
    setScanError(null)
    try {
      const res = await fetch('/api/garcom/nfe-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId: payment.id, qrContent }),
      })
      const data = await res.json() as { error?: string; ok?: boolean }
      if (!res.ok) {
        setScanError(data.error ?? 'Erro ao enviar a nota.')
        return
      }
      if ('vibrate' in navigator) navigator.vibrate(200)
      toast.success(`Nota enviada para ${payment.customerName}!`)
      await stopScanner()
      onSent()
    } catch {
      setScanError('Erro de conexão. Tente novamente.')
    } finally {
      submittingRef.current = false
      setSending(false)
    }
  }, [payment.id, payment.customerName, stopScanner, onSent])

  const submitRef = useRef(submit)
  submitRef.current = submit

  useEffect(() => {
    let mounted = true
    async function start() {
      try {
        const scanner = new Html5Qrcode(SCANNER_ID, { verbose: false })
        scannerRef.current = scanner
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 220, height: 220 }, aspectRatio: 1 },
          decoded => { void submitRef.current(decoded) },
          () => {},
        )
      } catch {
        if (mounted) setCameraDenied(true)
      }
    }
    void start()
    return () => {
      mounted = false
      void stopScanner()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- câmera só na montagem
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'rgba(13,17,23,0.96)', backdropFilter: 'blur(4px)' }}>
      <header className="flex items-center justify-between px-5 h-16 shrink-0"
        style={{ borderBottom: '1px solid #30363D' }}>
        <div className="min-w-0">
          <p className="text-sm font-bold truncate">Nota de {payment.customerName}</p>
          <p className="text-[11px] font-mono" style={{ color: '#8B949E' }}>
            {payment.locationLabel} · {formatCurrency(payment.amount)}
          </p>
        </div>
        <button type="button" onClick={() => { void stopScanner(); onClose() }}
          className="p-2 -mr-2 rounded-full" style={{ color: '#8B949E' }}>
          <span className="material-symbols-outlined">close</span>
        </button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 gap-5 overflow-y-auto py-6">
        <div className="flex items-center gap-2.5 w-full max-w-sm px-4 py-3 rounded-xl"
          style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.35)' }}>
          <span className="material-symbols-outlined text-[20px] shrink-0" style={{ color: '#fbbf24' }}>
            warning
          </span>
          <p className="text-xs leading-relaxed" style={{ color: '#fbbf24' }}>
            Confira antes de escanear: a nota deve ser de{' '}
            <strong style={{ color: '#FFFFFF' }}>{formatCurrency(payment.amount)}</strong>
            {' '}— o valor pago por <strong style={{ color: '#FFFFFF' }}>{payment.customerName}</strong>.
          </p>
        </div>

        {!cameraDenied && (
          <>
            <p className="text-sm text-center max-w-[280px]" style={{ color: '#8B949E' }}>
              Aponte a câmera para o <strong style={{ color: '#FFFFFF' }}>QR code impresso na nota fiscal</strong> (DANFE)
            </p>
            <div className="relative w-64 h-64 rounded-2xl overflow-hidden"
              style={{ border: '2px solid rgba(0,230,118,0.4)' }}>
              <div id={SCANNER_ID}
                className="absolute inset-0 [&>video]:object-cover [&>video]:w-full [&>video]:h-full" />
              {sending && (
                <div className="absolute inset-0 flex items-center justify-center"
                  style={{ background: 'rgba(13,17,23,0.7)' }}>
                  <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#00E676' }} />
                </div>
              )}
            </div>
          </>
        )}

        {cameraDenied && (
          <p className="text-sm text-center max-w-[280px]" style={{ color: '#e0c0b1' }}>
            Sem acesso à câmera. Cole abaixo a chave de acesso da nota (44 dígitos) ou o link do QR.
          </p>
        )}

        {scanError && (
          <p className="text-xs text-center max-w-[300px] px-4 py-3 rounded-xl font-mono"
            style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#fca5a5' }}>
            {scanError}
          </p>
        )}

        <div className="w-full max-w-sm space-y-2">
          <label className="text-[10px] font-mono uppercase tracking-wider block" style={{ color: '#8B949E' }}>
            Ou cole a chave de acesso / link da nota
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              inputMode="text"
              value={manualKey}
              onChange={e => setManualKey(e.target.value)}
              placeholder="44 dígitos ou https://..."
              className="flex-1 h-12 px-3 rounded-xl font-mono text-sm outline-none"
              style={{ background: '#161B22', border: '1px solid #30363D', color: '#FFFFFF' }}
            />
            <button type="button"
              disabled={sending || manualKey.trim().length < 10}
              onClick={() => void submit(manualKey)}
              className="shrink-0 h-12 px-4 rounded-xl font-bold font-mono text-xs disabled:opacity-40 active:scale-95 transition-transform"
              style={{ background: '#00E676', color: '#003319' }}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enviar'}
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
