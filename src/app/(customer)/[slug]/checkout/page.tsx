'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { loadStripe } from '@stripe/stripe-js'
import type { PaymentMethod } from '@/types'
import { formatCurrency, generateConfirmationCode } from '@/lib/utils'
import { toast } from 'sonner'
import { Loader2, ArrowLeft, CreditCard, Smartphone, CheckCircle2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

type Step = 'summary' | 'split' | 'payment' | 'confirmed'

export default function CheckoutPage() {
  const params = useParams<{ slug: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const sessionId = searchParams.get('session')

  const [step, setStep] = useState<Step>('summary')
  const [total, setTotal] = useState(0)
  const [splitCount, setSplitCount] = useState(1)
  const [method, setMethod] = useState<PaymentMethod>('pix')
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const [confirmationCode, setConfirmationCode] = useState('')

  useEffect(() => {
    if (!sessionId) { router.replace(`/${params.slug}`); return }

    async function loadTotal() {
      const supabase = createClient()
      const { data } = await supabase
        .from('order_items')
        .select('unit_price, quantity, order:orders!inner(session_id)')
        .eq('order.session_id', sessionId)

      const sum = (data ?? []).reduce((acc, i) => acc + i.unit_price * i.quantity, 0)
      setTotal(sum)
      setLoading(false)
    }
    loadTotal()
  }, [sessionId, params.slug, router])

  async function handlePay() {
    setPaying(true)
    const supabase = createClient()

    const amountToPay = total / splitCount

    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, amount: amountToPay, method }),
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error ?? 'Erro ao processar pagamento')

      if (method === 'pix' || method === 'debit') {
        const code = generateConfirmationCode()
        await supabase.from('payments').update({ status: 'paid', confirmation_code: code, paid_at: new Date().toISOString() }).eq('id', data.payment_id)
        setConfirmationCode(code)
        setStep('confirmed')
      } else {
        const stripe = await stripePromise
        if (!stripe || !data.client_secret) throw new Error('Stripe não inicializado')
        const { error } = await stripe.confirmCardPayment(data.client_secret)
        if (error) throw new Error(error.message)
        const code = generateConfirmationCode()
        await supabase.from('payments').update({ status: 'paid', confirmation_code: code, paid_at: new Date().toISOString() }).eq('id', data.payment_id)
        setConfirmationCode(code)
        setStep('confirmed')
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao processar pagamento')
    } finally {
      setPaying(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    )
  }

  if (step === 'confirmed') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-8">
        <div className="text-center space-y-6 max-w-sm w-full">
          <CheckCircle2 className="h-20 w-20 text-green-400 mx-auto" />
          <div>
            <h1 className="text-2xl font-bold">Pagamento Confirmado!</h1>
            <p className="text-slate-400 mt-2">Apresente este código ao garçom</p>
          </div>
          <div className="bg-slate-800 rounded-2xl p-8">
            <p className="text-5xl font-black tracking-widest text-orange-500">{confirmationCode}</p>
          </div>
          <p className="text-slate-500 text-sm">
            Valor pago: {formatCurrency(total / splitCount)}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-32">
      <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => step === 'summary' ? router.back() : setStep('summary')}>
          <ArrowLeft className="h-5 w-5 text-slate-600" />
        </button>
        <h1 className="text-lg font-bold text-slate-900">
          {step === 'summary' ? 'Fechar Conta' : step === 'split' ? 'Dividir Conta' : 'Pagamento'}
        </h1>
      </div>

      <div className="px-4 py-6 space-y-4">
        {/* Total */}
        <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm">
          <p className="text-sm text-slate-500 mb-1">Total da conta</p>
          <p className="text-3xl font-black text-slate-900">{formatCurrency(total)}</p>
        </div>

        {step === 'summary' && (
          <div className="space-y-3">
            <button
              onClick={() => setStep('split')}
              className="w-full flex items-center gap-4 bg-white rounded-xl border border-slate-100 p-4 shadow-sm text-left"
            >
              <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="font-semibold text-slate-900">Dividir conta</p>
                <p className="text-sm text-slate-500">Entre amigos da mesa</p>
              </div>
            </button>

            <Button
              onClick={() => setStep('payment')}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white h-14 rounded-xl text-base font-semibold"
            >
              Pagar conta inteira
            </Button>
          </div>
        )}

        {step === 'split' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm">
              <p className="text-sm font-semibold text-slate-700 mb-4">Quantas pessoas vão dividir?</p>
              <div className="flex items-center justify-center gap-6">
                <button
                  onClick={() => setSplitCount(Math.max(1, splitCount - 1))}
                  className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-lg font-bold"
                >-</button>
                <span className="text-3xl font-black text-slate-900 w-8 text-center">{splitCount}</span>
                <button
                  onClick={() => setSplitCount(splitCount + 1)}
                  className="w-10 h-10 rounded-full bg-orange-500 text-white flex items-center justify-center text-lg font-bold"
                >+</button>
              </div>
              <p className="text-center text-slate-500 text-sm mt-4">
                Cada pessoa paga: <span className="font-bold text-orange-500">{formatCurrency(total / splitCount)}</span>
              </p>
            </div>
            <Button
              onClick={() => setStep('payment')}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white h-14 rounded-xl text-base font-semibold"
            >
              Continuar
            </Button>
          </div>
        )}

        {step === 'payment' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm space-y-3">
              <p className="text-sm font-semibold text-slate-700 mb-2">Forma de pagamento</p>
              {(['pix', 'debit', 'credit'] as PaymentMethod[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMethod(m)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-colors ${method === m ? 'border-orange-500 bg-orange-50' : 'border-slate-100 bg-white'}`}
                >
                  {m === 'pix' ? <Smartphone className="h-5 w-5" /> : <CreditCard className="h-5 w-5" />}
                  <span className="font-medium capitalize">
                    {m === 'pix' ? 'PIX' : m === 'debit' ? 'Débito' : 'Crédito'}
                  </span>
                </button>
              ))}
            </div>

            <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm flex justify-between">
              <span className="font-semibold text-slate-700">Você paga</span>
              <span className="font-black text-orange-500 text-lg">{formatCurrency(total / splitCount)}</span>
            </div>

            <Button
              onClick={handlePay}
              disabled={paying}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white h-14 rounded-xl text-base font-semibold"
            >
              {paying ? <Loader2 className="h-5 w-5 animate-spin" /> : `Pagar ${formatCurrency(total / splitCount)}`}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
