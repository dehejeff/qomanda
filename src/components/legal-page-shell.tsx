import Link from 'next/link'
import { KiComandaLogo } from '@/components/kicomanda-logo'

export const LEGAL_C = {
  bg: '#0D1117',
  bgCard: '#161B22',
  border: 'rgba(88,66,55,0.35)',
  primary: '#00E676',
  text: '#FFFFFF',
  muted: '#8B949E',
  faint: '#30363D',
}

const font = { fontFamily: 'Geist, system-ui, sans-serif' }
const mono = { fontFamily: 'JetBrains Mono, monospace' }

type Props = {
  title: string
  subtitle: string
  updatedAt: string
  children: React.ReactNode
}

export function LegalPageShell({ title, subtitle, updatedAt, children }: Props) {
  return (
    <div style={{ background: LEGAL_C.bg, color: LEGAL_C.text, ...font }} className="min-h-screen">
      <nav
        className="fixed top-0 left-0 right-0 z-50 flex justify-between items-center px-6 md:px-12 h-16"
        style={{
          background: 'rgba(11,19,38,0.9)',
          borderBottom: `1px solid ${LEGAL_C.border}`,
          backdropFilter: 'blur(16px)',
        }}
      >
        <Link href="/" className="flex items-center gap-2.5">
          <KiComandaLogo size={28} />
          <span className="font-black text-base" style={{ letterSpacing: '-0.02em' }}>KiComanda</span>
        </Link>
        <Link href="/" className="text-sm transition-colors hover:opacity-80" style={{ ...mono, color: LEGAL_C.muted }}>
          ← Voltar ao site
        </Link>
      </nav>

      <main className="max-w-3xl mx-auto px-6 md:px-12 pt-28 pb-20">
        <header className="mb-10">
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ ...mono, color: LEGAL_C.muted }}>
            Atualizado em {updatedAt}
          </p>
          <h1 className="text-4xl md:text-5xl font-black mb-3" style={{ letterSpacing: '-0.03em' }}>
            {title}
          </h1>
          <p className="text-lg leading-relaxed" style={{ color: LEGAL_C.muted }}>
            {subtitle}
          </p>
        </header>

        <article
          className="rounded-2xl p-6 md:p-8 space-y-8 text-sm md:text-base leading-relaxed"
          style={{ background: LEGAL_C.bgCard, border: `1px solid ${LEGAL_C.border}` }}
        >
          {children}
        </article>
      </main>

      <footer className="py-8 px-6 text-center" style={{ borderTop: `1px solid ${LEGAL_C.border}` }}>
        <div className="flex flex-wrap items-center justify-center gap-4 text-xs mb-3" style={{ ...mono, color: LEGAL_C.faint }}>
          <Link href="/roadmap" className="hover:opacity-80">Roadmap</Link>
          <Link href="/termos" className="hover:opacity-80">Termos de uso</Link>
          <Link href="/privacidade" className="hover:opacity-80">Privacidade</Link>
          <a href="mailto:contato@kicomanda.com.br" className="hover:opacity-80">contato@kicomanda.com.br</a>
        </div>
        <p className="text-xs" style={{ ...mono, color: LEGAL_C.faint }}>
          © 2026 KiComanda. Todos os direitos reservados.
        </p>
      </footer>
    </div>
  )
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold" style={{ color: LEGAL_C.text }}>{title}</h2>
      <div className="space-y-3" style={{ color: LEGAL_C.muted }}>{children}</div>
    </section>
  )
}
