import { redirect } from 'next/navigation'
import { getRestaurantAccess } from '@/lib/restaurant-auth'
import { WaiterPaymentsMobile } from '@/components/waiter/waiter-payments-mobile'
import { WaiterNfeSend } from '@/components/waiter/waiter-nfe-send'

export default async function GarcomPagamentosPage() {
  const access = await getRestaurantAccess()
  if (access?.role === 'kitchen') redirect('/garcom/pedidos')

  return (
    <div className="space-y-8">
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-black" style={{ letterSpacing: '-0.02em' }}>Pagamentos</h1>
          <p className="text-sm mt-1 font-mono" style={{ color: '#8B949E' }}>
            Confirme dinheiro e PIX manual quando o cliente pagar
          </p>
        </div>
        <WaiterPaymentsMobile />
      </div>
      <WaiterNfeSend />
    </div>
  )
}
