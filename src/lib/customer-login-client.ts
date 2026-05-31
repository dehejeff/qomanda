import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import { persistCustomerAuth, setCustomerSessionToken } from '@/lib/customer-auth'
import type { CustomerAuthPayload, CustomerLoginResponse } from '@/lib/customer-login-types'

export async function loginWithWhatsApp(
  whatsapp: string,
): Promise<CustomerLoginResponse | CustomerAuthPayload | { error: string }> {
  const res = await fetch('/api/customer/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ whatsapp }),
  })
  const data = await res.json()
  if (!res.ok) return { error: data.error ?? 'Não foi possível entrar.' }
  return data as CustomerLoginResponse
}

export async function verifyLoginPin(
  challengeToken: string,
  pin: string,
): Promise<CustomerAuthPayload & { sessionToken?: string; error?: string }> {
  const res = await fetch('/api/customer/login/verify-pin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ challengeToken, pin }),
  })
  return res.json()
}

export function finishCustomerLogin(
  data: CustomerAuthPayload & { sessionToken?: string },
  router: AppRouterInstance,
) {
  persistCustomerAuth(data.customerId, data.firstName, data.lastName, data.activeSession)
  if (data.sessionToken) setCustomerSessionToken(data.sessionToken)
  router.push('/hub')
}
