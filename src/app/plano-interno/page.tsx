import type { Metadata } from 'next'
import { QomandaLogo } from '@/components/qomanda-logo'

// URL escondida — fora de qualquer navegação e fora de buscadores.
export const metadata: Metadata = {
  title: 'Plano de Negócios · Qomanda (Confidencial)',
  robots: { index: false, follow: false },
}

const C = {
  bg: '#0b1326', card: '#131b2e', border: 'rgba(88,66,55,0.35)', borderBlu: 'rgba(51,65,85,0.6)',
  primary: '#f97316', primaryDm: '#ffb690', text: '#dae2fd', muted: '#a78b7d', faint: '#584237',
  green: '#34d399', red: '#f87171', blue: '#7bd0ff', amber: '#fbbf24',
}
const mono = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' } as const

function brl(n: number): string {
  const s = Math.abs(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
  return n < 0 ? `−${s}` : s
}

type Row = {
  mes: string; novos: number; ativos: number; pag: number
  mrr: number; setup: number; total: number; lucro: number; acum: number
}

// Projeção base — ver "Premissas" abaixo. Cenário conservador, sem churn.
const ROWS: Row[] = [
  { mes: 'Mês 1',  novos: 1, ativos: 1,  pag: 0,  mrr: 0,     setup: 1990, total: 1990,  lucro: -1210, acum: -1210 },
  { mes: 'Mês 2',  novos: 2, ativos: 3,  pag: 1,  mrr: 500,   setup: 3980, total: 4480,  lucro: 1280,  acum: 70 },
  { mes: 'Mês 3',  novos: 2, ativos: 5,  pag: 3,  mrr: 1500,  setup: 3980, total: 5480,  lucro: 2280,  acum: 2350 },
  { mes: 'Mês 4',  novos: 3, ativos: 8,  pag: 5,  mrr: 2500,  setup: 5970, total: 8470,  lucro: 5270,  acum: 7620 },
  { mes: 'Mês 5',  novos: 3, ativos: 11, pag: 8,  mrr: 4000,  setup: 5970, total: 9970,  lucro: 6770,  acum: 14390 },
  { mes: 'Mês 6',  novos: 3, ativos: 14, pag: 11, mrr: 5500,  setup: 5970, total: 11470, lucro: 8270,  acum: 22660 },
  { mes: 'Mês 7',  novos: 3, ativos: 17, pag: 14, mrr: 7000,  setup: 5970, total: 12970, lucro: 9770,  acum: 32430 },
  { mes: 'Mês 8',  novos: 3, ativos: 20, pag: 17, mrr: 8500,  setup: 5970, total: 14470, lucro: 11270, acum: 43700 },
  { mes: 'Mês 9',  novos: 3, ativos: 23, pag: 20, mrr: 10000, setup: 5970, total: 15970, lucro: 12770, acum: 56470 },
  { mes: 'Mês 10', novos: 3, ativos: 26, pag: 23, mrr: 11500, setup: 5970, total: 17470, lucro: 14270, acum: 70740 },
  { mes: 'Mês 11', novos: 2, ativos: 28, pag: 26, mrr: 13000, setup: 3980, total: 16980, lucro: 13780, acum: 84520 },
  { mes: 'Mês 12', novos: 2, ativos: 30, pag: 28, mrr: 14000, setup: 3980, total: 17980, lucro: 14780, acum: 99300 },
]

function Metric({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl p-5" style={{ background: C.card, border: `1px solid ${C.borderBlu}` }}>
      <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: C.muted }}>{label}</p>
      <p className="text-2xl font-black mt-1" style={{ color: color ?? C.primaryDm, fontFamily: 'Geist, sans-serif' }}>{value}</p>
      {sub && <p className="text-[11px] mt-1" style={{ color: C.faint }}>{sub}</p>}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold" style={{ color: C.text }}>{title}</h2>
      {children}
    </section>
  )
}

export default function PlanoInternoPage() {
  return (
    <div className="min-h-screen" style={{ background: C.bg, color: C.text, fontFamily: 'Geist, sans-serif' }}>
      <div className="max-w-5xl mx-auto px-4 md:px-10 py-10 space-y-12">

        {/* Header */}
        <header className="space-y-4">
          <div className="flex items-center gap-2.5">
            <QomandaLogo size={28} />
            <span className="font-black text-base" style={{ letterSpacing: '-0.02em' }}>Qomanda</span>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full"
            style={{ background: 'rgba(248,113,113,0.1)', border: `1px solid rgba(248,113,113,0.3)` }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: C.red }} />
            <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: C.red }}>
              Confidencial · uso interno dos sócios
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black" style={{ letterSpacing: '-0.03em' }}>
            Plano de Negócios — Ano 1
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: C.muted }}>
            Modelo financeiro, estrutura de custos e meta projetada mês a mês. Os números são um
            <strong style={{ color: C.text }}> cenário base conservador</strong> — servem para alinhar metas, não como garantia.
            As premissas estão listadas no fim para serem desafiadas e ajustadas.
          </p>
        </header>

        {/* Métricas-chave */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Metric label="MRR no Mês 12" value="R$ 14 mil" sub="receita recorrente/mês" color={C.green} />
          <Metric label="ARR (anualizado)" value="R$ 168 mil" sub="MRR × 12 ao fim do ano" color={C.green} />
          <Metric label="Lucro Ano 1" value="R$ 99 mil" sub="com implantação · 72% margem" color={C.primaryDm} />
          <Metric label="Investimento inicial" value="~R$ 1,2 mil" sub="único mês no vermelho (Mês 1)" color={C.amber} />
        </div>

        {/* Modelo de receita */}
        <Section title="1. Como ganhamos dinheiro">
          <div className="rounded-xl p-5 space-y-3 text-sm leading-relaxed" style={{ background: C.card, border: `1px solid ${C.borderBlu}`, color: C.text }}>
            <p>
              <strong style={{ color: C.primaryDm }}>Recebimento direto:</strong> o pagamento do cliente cai 100% na conta do restaurante
              (gateway dele — Asaas/Mercado Pago/PIX). A Qomanda nunca segura o dinheiro, então
              <strong> não pagamos taxa de gateway</strong> — o custo marginal por transação é praticamente zero.
            </p>
            <p>
              <strong style={{ color: C.primaryDm }}>Duas fontes de receita:</strong>
            </p>
            <ul className="space-y-1.5 pl-1" style={{ color: C.muted }}>
              <li>💳 <strong style={{ color: C.text }}>Mensalidade (SaaS)</strong> — o motor recorrente. R$ 299 / 399 / 599 por plano.</li>
              <li>📈 <strong style={{ color: C.text }}>Comissão flat</strong> sobre GMV digital — 0,7% / 0,5% / 0,3% por plano, faturada no dia 5.</li>
              <li>🛠️ <strong style={{ color: C.text }}>Implantação</strong> — R$ 1.990 único por cliente (onboarding/piloto). Caixa extra no início.</li>
            </ul>
            <p className="text-xs pt-1" style={{ color: C.faint }}>
              Comissão baixa de propósito: a Qomanda não traz a demanda (o cliente já está na mesa) — o valor está no software,
              que se cobra na mensalidade. Isso nos mantém mais baratos que a maquininha que o restaurante deixa.
            </p>
          </div>
        </Section>

        {/* Custos */}
        <Section title="2. Estrutura de custos (mensal)">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Metric label="Pró-labore (2 sócios)" value="R$ 3.000" sub="R$ 1.500 cada" />
            <Metric label="Ferramentas (Claude Pro)" value="~R$ 200" sub="infra Vercel/Supabase no plano grátis" />
            <Metric label="Custo fixo total" value="R$ 3.200" sub="constante no Ano 1" color={C.red} />
          </div>
          <p className="text-xs" style={{ color: C.faint }}>
            Custo marginal por restaurante ≈ R$ 0 (modelo direto). Logo, quase toda receita acima de R$ 3.200/mês é lucro.
            O pró-labore já é a remuneração dos sócios — o "lucro" abaixo é o que sobra <em>depois</em> de pagar os R$ 1.500 de cada um.
          </p>
        </Section>

        {/* Projeção mês a mês */}
        <Section title="3. Projeção mês a mês (Ano 1)">
          <div className="rounded-xl overflow-x-auto" style={{ border: `1px solid ${C.borderBlu}` }}>
            <table className="w-full text-sm min-w-[760px]" style={mono}>
              <thead>
                <tr style={{ background: C.card }}>
                  {['Mês', 'Novos', 'Ativos', 'Pagantes', 'Mensalidade', 'Implantação', 'Receita', 'Lucro mês', 'Lucro acum.'].map(h => (
                    <th key={h} className="px-3 py-3 text-left text-[10px] uppercase tracking-wider font-medium" style={{ color: C.muted }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((r, i) => (
                  <tr key={r.mes} style={{ borderTop: `1px solid ${C.border}`, background: i % 2 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                    <td className="px-3 py-2.5 font-bold" style={{ color: C.text }}>{r.mes}</td>
                    <td className="px-3 py-2.5" style={{ color: C.muted }}>+{r.novos}</td>
                    <td className="px-3 py-2.5" style={{ color: C.text }}>{r.ativos}</td>
                    <td className="px-3 py-2.5" style={{ color: C.muted }}>{r.pag}</td>
                    <td className="px-3 py-2.5" style={{ color: C.text }}>{brl(r.mrr)}</td>
                    <td className="px-3 py-2.5" style={{ color: C.faint }}>{brl(r.setup)}</td>
                    <td className="px-3 py-2.5 font-semibold" style={{ color: C.primaryDm }}>{brl(r.total)}</td>
                    <td className="px-3 py-2.5" style={{ color: r.lucro < 0 ? C.red : C.green }}>{brl(r.lucro)}</td>
                    <td className="px-3 py-2.5 font-bold" style={{ color: r.acum < 0 ? C.red : C.green }}>{brl(r.acum)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: `2px solid ${C.borderBlu}`, background: C.card }}>
                  <td className="px-3 py-3 font-black" style={{ color: C.text }}>Ano 1</td>
                  <td className="px-3 py-3 font-bold" style={{ color: C.text }}>30</td>
                  <td className="px-3 py-3" style={{ color: C.faint }}>—</td>
                  <td className="px-3 py-3" style={{ color: C.faint }}>—</td>
                  <td className="px-3 py-3 font-bold" style={{ color: C.text }}>R$ 78 mil</td>
                  <td className="px-3 py-3 font-bold" style={{ color: C.text }}>R$ 60 mil</td>
                  <td className="px-3 py-3 font-black" style={{ color: C.primaryDm }}>R$ 138 mil</td>
                  <td className="px-3 py-3" style={{ color: C.faint }}>—</td>
                  <td className="px-3 py-3 font-black" style={{ color: C.green }}>R$ 99 mil</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="rounded-lg p-3" style={{ background: C.card, border: `1px solid ${C.border}` }}>
              <span style={{ color: C.green }}>● Break-even mensal</span>
              <p style={{ color: C.muted }} className="mt-1">A partir do <strong style={{ color: C.text }}>Mês 5</strong> (≈8 pagantes) a mensalidade sozinha cobre o custo fixo.</p>
            </div>
            <div className="rounded-lg p-3" style={{ background: C.card, border: `1px solid ${C.border}` }}>
              <span style={{ color: C.green }}>● Caixa positivo</span>
              <p style={{ color: C.muted }} className="mt-1">Com a implantação, só o <strong style={{ color: C.text }}>Mês 1</strong> fecha negativo (≈ −R$ 1,2 mil). Do Mês 2 em diante, lucro todo mês.</p>
            </div>
            <div className="rounded-lg p-3" style={{ background: C.card, border: `1px solid ${C.border}` }}>
              <span style={{ color: C.amber }}>● Cenário só recorrente</span>
              <p style={{ color: C.muted }} className="mt-1">Sem contar implantação, o lucro do ano cai p/ <strong style={{ color: C.text }}>~R$ 40 mil</strong> e o acumulado vira positivo no Mês 8. É o piso seguro.</p>
            </div>
          </div>
        </Section>

        {/* Marcos */}
        <Section title="4. Metas por trimestre">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { q: 'Q1 · Mês 1–3', meta: '5 clientes', foco: 'Validar piloto, ajustar processos, primeiros recibos reais. Quase break-even.' },
              { q: 'Q2 · Mês 4–6', meta: '14 clientes', foco: 'MRR R$ 5,5 mil. Lucro consistente todo mês. Refinar onboarding.' },
              { q: 'Q3 · Mês 7–9', meta: '23 clientes', foco: 'MRR R$ 10 mil. Pró-labore folgado; considerar reinvestir em aquisição.' },
              { q: 'Q4 · Mês 10–12', meta: '30 clientes', foco: 'MRR R$ 14 mil · ARR R$ 168 mil. Base sólida para escalar no Ano 2.' },
            ].map(item => (
              <div key={item.q} className="rounded-xl p-4" style={{ background: C.card, border: `1px solid ${C.borderBlu}` }}>
                <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: C.muted }}>{item.q}</p>
                <p className="text-xl font-black mt-1" style={{ color: C.primaryDm }}>{item.meta}</p>
                <p className="text-xs mt-2 leading-relaxed" style={{ color: C.muted }}>{item.foco}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Premissas e riscos */}
        <Section title="5. Premissas e riscos (desafiar aqui)">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl p-5 space-y-2 text-sm" style={{ background: C.card, border: `1px solid ${C.borderBlu}` }}>
              <p className="text-xs font-mono uppercase tracking-widest mb-2" style={{ color: C.blue }}>Premissas</p>
              <ul className="space-y-1.5" style={{ color: C.muted }}>
                <li>• Receita recorrente média: <strong style={{ color: C.text }}>R$ 500/cliente/mês</strong> (mensalidade ~R$ 350 + comissão ~R$ 150).</li>
                <li>• Comissão ~R$ 150 assume <strong style={{ color: C.text }}>~R$ 25 mil de GMV digital</strong>/restaurante — número ainda não validado.</li>
                <li>• Cliente novo entra em <strong style={{ color: C.text }}>trial</strong> (paga recorrente só no mês seguinte).</li>
                <li>• Implantação R$ 1.990 cobrada a todo cliente.</li>
                <li>• <strong style={{ color: C.text }}>Churn zero</strong> no Ano 1 (otimista).</li>
                <li>• 30 clientes ativos ao fim do ano.</li>
              </ul>
            </div>
            <div className="rounded-xl p-5 space-y-2 text-sm" style={{ background: C.card, border: `1px solid ${C.borderBlu}` }}>
              <p className="text-xs font-mono uppercase tracking-widest mb-2" style={{ color: C.amber }}>Riscos & alavancas</p>
              <ul className="space-y-1.5" style={{ color: C.muted }}>
                <li>⚠️ <strong style={{ color: C.text }}>GMV real</strong> abaixo do previsto reduz a comissão — mas a mensalidade segura o piso.</li>
                <li>⚠️ <strong style={{ color: C.text }}>Implantação R$ 1.990</strong> pode ser barreira; dá pra parcelar ou reduzir na largada.</li>
                <li>⚠️ <strong style={{ color: C.text }}>Churn</strong> não modelado — acompanhar de perto.</li>
                <li>🚀 Custo marginal ≈ 0: acima de 30 clientes a <strong style={{ color: C.text }}>margem dispara</strong>.</li>
                <li>🚀 Subir pró-labore quando MRR passar de R$ 10 mil.</li>
                <li>🚀 Upsell de plano (Starter→Growth→Pro) aumenta receita sem novo cliente.</li>
              </ul>
            </div>
          </div>
        </Section>

        <footer className="pt-6 text-center text-xs" style={{ ...mono, color: C.faint, borderTop: `1px solid ${C.border}` }}>
          <p className="pt-6">Documento interno Qomanda · gerado para alinhamento entre sócios · não compartilhar externamente</p>
        </footer>
      </div>
    </div>
  )
}
