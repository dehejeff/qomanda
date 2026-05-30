import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-05-27.dahlia',
})

export const formatAmountForStripe = (amount: number): number =>
  Math.round(amount * 100)

export const formatAmountFromStripe = (amount: number): number =>
  amount / 100
