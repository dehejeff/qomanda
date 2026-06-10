import type { Metadata } from 'next'
import { PilotosChecklist } from '@/components/pilotos/pilotos-checklist'

export const metadata: Metadata = {
  title: 'Piloto — 5 primeiros restaurantes · Qomanda',
  description: 'Checklist operacional para go-live dos cinco primeiros restaurantes piloto da Qomanda.',
  robots: { index: false, follow: false },
}

export default function PilotosPage() {
  return <PilotosChecklist />
}
