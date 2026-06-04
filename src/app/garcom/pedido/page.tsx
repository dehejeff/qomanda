import { Suspense } from 'react'
import { WaiterOrderFlow } from '@/components/waiter/waiter-order-flow'

export default function GarcomPedidoPage() {
  return (
    <Suspense fallback={null}>
      <WaiterOrderFlow />
    </Suspense>
  )
}
