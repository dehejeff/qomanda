import { redirect } from 'next/navigation'
import { getRestaurantAccess } from '@/lib/restaurant-auth'

export default async function GarcomIndexPage() {
  const access = await getRestaurantAccess()
  // Recepcionista cai direto na Fila de espera (sua única área).
  redirect(access?.role === 'recepcionista' ? '/garcom/fila' : '/garcom/pedidos')
}
