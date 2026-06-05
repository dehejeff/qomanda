import Link from 'next/link'
import type { Metadata } from 'next'
import { QomandaLogo } from '@/components/qomanda-logo'

export const metadata: Metadata = {
  title: 'Integrações · Qomanda',
  description: 'Gateways de pagamento, notas fiscais e mensageria integrados à Qomanda.',
}

const C = {
  bg: '#0b1326', card: '#131b2e', border: 'rgba(88,66,55,0.35)', borderBlu: 'rgba(51,65,85,0.6)',
  primary: '#f97316', primaryDm: '#ffb690', text: '#dae2fd', muted: '#a78b7d', faint: '#584237',
  green: '#34d399', blue: '#7bd0ff',
}

type Item = { name: string; desc: string; tags: string[] }
type Section = { title: string; intro: string; items: Item[] }

const ENABLED: Section[] = [
  {
    title: 'Pagamentos — disponíveis hoje',
    intro: 'O dinheiro cai 100% na conta do restaurante. A Qomanda cobra mensalidade + comissão sobre o GMV digital.',
    items: [
      { name: 'PIX manual', desc: 'Chave PIX do próprio restaurante exibida no checkout. Funciona sem nenhum gateway — ativa na hora.', tags: ['PIX', 'sem gateway'] },
      { name: 'Dinheiro', desc: 'Pagamento na mesa/balcão confirmado pelo garçom. Sem comissão.', tags: ['cash', '0% comissão'] },
      { name: 'Asaas', desc: 'PIX e cartão na conta Asaas do restaurante, com confirmação automática por webhook.', tags: ['PIX', 'cartão', 'webhook'] },
      { name: 'Mercado Pago', desc: 'PIX e cartão na conta MP. Conexão em 1 clique (OAuth) ou token manual.', tags: ['PIX', 'cartão', 'OAuth'] },
    ],
  },
  {
    title: 'Nota fiscal',
    intro: 'Emissão automática após o pagamento, com envio do link ao cliente.',
    items: [
      { name: 'Focus NFe', desc: 'NFC-e (modelo 65) e NFS-e por restaurante. Certificado A1 fica no provedor; a Qomanda emite via API.', tags: ['NFC-e', 'NFS-e'] },
      { name: 'Modo simulado', desc: 'Para testar o fluxo ponta a ponta antes de ligar as credenciais fiscais reais.', tags: ['testes'] },
    ],
  },
  {
    title: 'Mensageria',
    intro: 'Comunicação direta com o cliente.',
    items: [
      { name: 'WhatsApp Business (Meta)', desc: 'Envio da nota fiscal e avisos ao cliente, com os números do próprio restaurante.', tags: ['WhatsApp', 'NF-e'] },
    ],
  },
]

const SOON: Item[] = [
  { name: 'PagBank', desc: 'Onboarding vendedor + PIX/cartão.', tags: ['Fase 3'] },
  { name: 'Stone', desc: 'Link de pagamento ou API direta.', tags: ['Fase 3'] },
  { name: 'Cielo', desc: 'Adquirência cartão.', tags: ['Fase 4'] },
  { name: 'Getnet', desc: 'Adquirência cartão.', tags: ['Fase 4'] },
]

const mono = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' } as const

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ ...mono, background: 'rgba(123,208,255,0.08)', color: C.blue, border: `1px solid ${C.borderBlu}` }}>
      {children}
    </span>
  )
}

export default function IntegracoesPage() {
  return (
    <div className="min-h-screen" style={{ background: C.bg, color: C.text, fontFamily: 'Geist, sans-serif' }}>
      <nav className="flex items-center justify-between px-4 md:px-12 py-5 max-w-6xl mx-auto">
        <Link href="/" className="flex items-center gap-2.5">
          <QomandaLogo size={28} />
          <span className="font-black text-base" style={{ letterSpacing: '-0.02em' }}>Qomanda</span>
        </Link>
        <Link href="/cadastro" className="px-4 py-2 rounded-lg text-sm font-bold" style={{ background: C.primary, color: '#582200' }}>
          Começar
        </Link>
      </nav>

      <header className="max-w-3xl mx-auto px-4 md:px-12 pt-10 pb-8 text-center">
        <p className="text-[11px] uppercase tracking-widest mb-3" style={{ ...mono, color: C.muted }}>Integrações</p>
        <h1 className="text-3xl md:text-5xl font-black" style={{ letterSpacing: '-0.03em' }}>
          Conecte o que sua operação já usa
        </h1>
        <p className="text-base mt-4" style={{ color: C.muted }}>
          Pagamentos, notas fiscais e WhatsApp integrados — o recebimento cai direto na conta do restaurante.
        </p>
      </header>

      <main className="max-w-5xl mx-auto px-4 md:px-12 pb-16 space-y-12">
        {ENABLED.map(section => (
          <section key={section.title}>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-xl font-bold">{section.title}</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ ...mono, background: 'rgba(52,211,153,0.1)', color: C.green, border: '1px solid rgba(52,211,153,0.25)' }}>
                ativo
              </span>
            </div>
            <p className="text-sm mb-5" style={{ color: C.muted }}>{section.intro}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {section.items.map(item => (
                <div key={item.name} className="rounded-xl p-5" style={{ background: C.card, border: `1px solid ${C.borderBlu}` }}>
                  <h3 className="font-semibold text-base" style={{ color: C.primaryDm }}>{item.name}</h3>
                  <p className="text-sm mt-1.5 leading-relaxed" style={{ color: C.text }}>{item.desc}</p>
                  <div className="flex flex-wrap gap-1.5 mt-3">{item.tags.map(t => <Chip key={t}>{t}</Chip>)}</div>
                </div>
              ))}
            </div>
          </section>
        ))}

        <section>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-xl font-bold">Em breve</h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ ...mono, background: 'rgba(167,139,125,0.1)', color: C.muted, border: `1px solid ${C.border}` }}>
              no roadmap
            </span>
          </div>
          <p className="text-sm mb-5" style={{ color: C.muted }}>
            Novos gateways em desenvolvimento — acompanhe no <Link href="/roadmap" className="underline" style={{ color: C.blue }}>roadmap</Link>.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {SOON.map(item => (
              <div key={item.name} className="rounded-xl p-4" style={{ background: C.card, border: `1px solid ${C.border}`, opacity: 0.75 }}>
                <h3 className="font-semibold text-sm">{item.name}</h3>
                <p className="text-xs mt-1" style={{ color: C.muted }}>{item.desc}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">{item.tags.map(t => <Chip key={t}>{t}</Chip>)}</div>
              </div>
            ))}
          </div>
        </section>

        <div className="rounded-2xl p-8 text-center" style={{ background: 'linear-gradient(135deg, rgba(249,115,22,0.12), transparent)', border: `1px solid ${C.border}` }}>
          <h2 className="text-2xl font-black" style={{ letterSpacing: '-0.02em' }}>Pronto para começar?</h2>
          <p className="text-sm mt-2 mb-5" style={{ color: C.muted }}>PIX manual e dinheiro funcionam no primeiro dia, sem nenhuma integração.</p>
          <Link href="/cadastro" className="inline-block px-6 py-3 rounded-lg text-sm font-bold" style={{ background: C.primary, color: '#582200' }}>
            Começar 14 dias grátis
          </Link>
        </div>
      </main>

      <footer className="py-10 px-4 md:px-12 w-full" style={{ borderTop: `1px solid ${C.border}` }}>
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-sm" style={{ ...mono, color: C.faint }}>
          <Link href="/" className="hover:opacity-80">← Início</Link>
          <div className="flex items-center gap-6">
            <Link href="/roadmap" className="hover:opacity-80">Roadmap</Link>
            <Link href="/termos" className="hover:opacity-80">Termos</Link>
            <Link href="/privacidade" className="hover:opacity-80">Privacidade</Link>
          </div>
          <span>© 2026 Qomanda</span>
        </div>
      </footer>
    </div>
  )
}
