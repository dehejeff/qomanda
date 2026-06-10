import type { Metadata } from 'next'
import { MateriaisView } from '@/components/materiais/materiais-view'
import { VENDAS_CONTENT } from '@/lib/materiais/vendas-content'

export const metadata: Metadata = {
  title: 'Materiais de Vendas · KiComanda (Confidencial)',
  robots: { index: false, follow: false },
}

export default function MateriaisVendasPage() {
  return <MateriaisView content={VENDAS_CONTENT} />
}
