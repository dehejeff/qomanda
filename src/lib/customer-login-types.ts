import type { CustomerActiveSession } from '@/lib/customer-auth-server'

export type CustomerAuthPayload = {
  customerId: string
  firstName: string
  lastName: string
  activeSession: CustomerActiveSession | null
}

export type CustomerLoginResponse =
  | ({ requiresPin: false } & CustomerAuthPayload)
  | { requiresPin: true; challengeToken: string; firstName: string }
