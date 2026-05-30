import Stripe from 'stripe'

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) throw new Error('STRIPE_SECRET_KEY not configured')
    _stripe = new Stripe(key, { apiVersion: '2026-05-27.dahlia' })
  }
  return _stripe
}

export const formatAmountForStripe = (amount: number): number =>
  Math.round(amount * 100)

export const formatAmountFromStripe = (amount: number): number =>
  amount / 100
