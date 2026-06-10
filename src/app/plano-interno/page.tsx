import type { Metadata } from 'next'
import { PlanoProjection } from '@/components/plano-interno/plano-projection'

export const metadata: Metadata = {
  title: 'Projeção Financeira · 5 Anos · KiComanda (Confidencial)',
  robots: { index: false, follow: false },
}

export default function PlanoInternoPage() {
  return <PlanoProjection />
}
