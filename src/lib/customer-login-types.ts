import type { CustomerActiveSession } from '@/lib/customer-auth-server'

export type CustomerAuthPayload = {
  customerId: string
  firstName: string
  lastName: string
  activeSession: CustomerActiveSession | null
}

export type CustomerLoginResponse =
  | ({ requiresPin: false } & CustomerAuthPayload & { sessionToken?: string })
  | {
      requiresPin: true
      challengeToken: string
      firstName: string
      pinLength: 4 | 6
      /** Emite sessionToken após verificação (clientes com cartão salvo). */
      requiresSession?: boolean
    }
