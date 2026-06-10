import type { Metadata } from 'next'
import { MateriaisView } from '@/components/materiais/materiais-view'
import { ENTREGA_CONTENT } from '@/lib/materiais/entrega-content'

export const metadata: Metadata = {
  title: 'Materiais de Entrega · KiComanda (Confidencial)',
  robots: { index: false, follow: false },
}

export default function MateriaisEntregaPage() {
  return <MateriaisView content={ENTREGA_CONTENT} />
}
