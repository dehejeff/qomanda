'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { MateriaisBlock, MateriaisPageContent, MateriaisSection } from '@/lib/materiais/types'

const C = {
  bg: '#06080f',
  surface: '#0c1120',
  surface2: '#111827',
  border: 'rgba(255,255,255,0.06)',
  border2: 'rgba(255,255,255,0.1)',
  text: '#e2e8f4',
  muted: '#718096',
  green: '#10b981',
  orange: '#00E676',
  blue: '#60a5fa',
} as const

const mono = { fontFamily: 'JetBrains Mono, ui-monospace, monospace' } as const

function SectionNav({ sections }: { sections: MateriaisSection[] }) {
  return (
    <nav className="flex flex-wrap gap-2 mb-8">
      {sections.map(s => (
        <a
          key={s.id}
          href={`#${s.id}`}
          className="text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-md transition-colors hover:opacity-90"
          style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.muted }}
        >
          {s.title}
        </a>
      ))}
    </nav>
  )
}

function CopyButton({ text }: { text: string }) {
  const [ok, setOk] = useState(false)
  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
      setOk(true)
      setTimeout(() => setOk(false), 2000)
    } catch { /* ignore */ }
  }, [text])
  return (
    <button
      type="button"
      onClick={copy}
      className="text-[10px] uppercase tracking-wider px-2 py-1 rounded cursor-pointer shrink-0"
      style={{ background: ok ? 'rgba(16,185,129,0.15)' : 'rgba(59,130,246,0.12)', color: ok ? C.green : C.blue, border: `1px solid ${C.border}` }}
    >
      {ok ? 'Copiado' : 'Copiar'}
    </button>
  )
}

function ChecklistBlock({ storageKey, title, items }: Extract<MateriaisBlock, { type: 'checklist' }>) {
  const [checks, setChecks] = useState<Record<string, boolean>>({})

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) setChecks(JSON.parse(raw) as Record<string, boolean>)
    } catch { /* ignore */ }
  }, [storageKey])

  const toggle = useCallback((id: string) => {
    setChecks(prev => {
      const next = { ...prev, [id]: !prev[id] }
      try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [storageKey])

  const done = useMemo(() => items.filter(i => checks[i.id]).length, [checks, items])

  return (
    <div className="mb-4">
      {title && (
        <p className="text-[11px] mb-2" style={{ color: C.muted }}>
          {title} — <span style={{ color: C.green }}>{done}/{items.length}</span>
        </p>
      )}
      <div className="flex flex-col gap-1.5">
        {items.map(item => (
          <label
            key={item.id}
            className="flex items-start gap-3 rounded-md px-3.5 py-2.5 cursor-pointer text-[11px] leading-relaxed"
            style={{
              background: C.surface2,
              border: `1px solid ${checks[item.id] ? 'rgba(16,185,129,0.3)' : C.border}`,
              color: C.muted,
            }}
          >
            <input type="checkbox" checked={!!checks[item.id]} onChange={() => toggle(item.id)} className="mt-0.5 accent-[#10b981]" />
            <span>
              <span className="block font-medium" style={{ color: checks[item.id] ? C.green : C.text }}>{item.label}</span>
              {item.hint && <span className="text-[10px]">{item.hint}</span>}
            </span>
          </label>
        ))}
      </div>
    </div>
  )
}

function BlockRenderer({ block }: { block: MateriaisBlock }) {
  if (block.type === 'text') {
    return (
      <div className="mb-4 rounded-[10px] overflow-hidden" style={{ border: `1px solid ${C.border}`, background: C.surface }}>
        {(block.title || block.copyable) && (
          <div className="flex items-center justify-between gap-2 px-4 py-2" style={{ borderBottom: `1px solid ${C.border}`, background: C.surface2 }}>
            {block.title && <span className="text-[10px] uppercase tracking-wider" style={{ color: C.muted }}>{block.title}</span>}
            {block.copyable && <CopyButton text={block.body} />}
          </div>
        )}
        <pre className="px-4 py-3 text-[11px] leading-relaxed whitespace-pre-wrap" style={{ color: C.text, ...mono }}>{block.body}</pre>
      </div>
    )
  }
  if (block.type === 'list') {
    return (
      <div className="mb-4">
        {block.title && <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: C.muted }}>{block.title}</p>}
        <ol className="flex flex-col gap-1.5 list-none">
          {block.items.map((item, i) => (
            <li key={item} className="flex gap-2.5 rounded-md px-3.5 py-2.5 text-[11px] leading-relaxed" style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.text }}>
              <span className="text-[10px] shrink-0 font-semibold" style={{ color: C.muted }}>{String(i + 1).padStart(2, '0')}</span>
              {item}
            </li>
          ))}
        </ol>
      </div>
    )
  }
  if (block.type === 'table') {
    return (
      <div className="mb-4 rounded-[10px] overflow-x-auto" style={{ border: `1px solid ${C.border}` }}>
        {block.title && <p className="text-[10px] uppercase tracking-wider px-4 py-2" style={{ color: C.muted, background: C.surface2, borderBottom: `1px solid ${C.border}` }}>{block.title}</p>}
        <table className="w-full border-collapse text-[11px]" style={{ background: C.surface, ...mono }}>
          <thead>
            <tr>
              {block.headers.map(h => (
                <th key={h} className="px-4 py-2.5 text-left font-medium" style={{ color: C.muted, borderBottom: `1px solid ${C.border}`, background: C.surface2 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci} className="px-4 py-2.5 align-top" style={{ color: C.text, borderBottom: `1px solid ${C.border}` }}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }
  if (block.type === 'checklist') {
    return <ChecklistBlock {...block} />
  }
  if (block.type === 'link') {
    return (
      <div className="mb-4 rounded-md px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2" style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}>
        <div>
          {block.title && <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: C.muted }}>{block.title}</p>}
          {block.desc && <p className="text-[10px]" style={{ color: C.muted }}>{block.desc}</p>}
        </div>
        <Link href={block.href} className="text-[11px] font-semibold hover:underline" style={{ color: C.blue }}>{block.label}</Link>
      </div>
    )
  }
  return null
}

export function MateriaisView({ content }: { content: MateriaisPageContent }) {
  return (
    <div className="min-h-screen" style={{ background: C.bg, color: C.text, ...mono, fontSize: 13 }}>
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 50% 40% at 10% 0%, rgba(0,230,118,0.05) 0%, transparent 55%)' }}
      />
      <div className="relative max-w-[900px] mx-auto px-6 py-10 pb-20">
        <header className="mb-8 pb-6" style={{ borderBottom: `1px solid ${C.border2}` }}>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: C.green }}>
            <span className="w-2 h-2 rounded-full" style={{ background: C.green, boxShadow: `0 0 12px ${C.green}` }} />
            KiComanda
          </div>
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-4"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            <span className="text-[10px] uppercase tracking-widest text-red-400">Confidencial · uso interno</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{content.title}</h1>
          <p className="text-[11px] mt-2 tracking-wide" style={{ color: C.muted }}>{content.subtitle}</p>
          <div className="flex flex-wrap gap-4 mt-4">
            {content.related.map(r => (
              <Link key={r.href} href={r.href} className="text-[11px] hover:underline" style={{ color: C.orange }}>{r.label}</Link>
            ))}
          </div>
        </header>

        <SectionNav sections={content.sections} />

        {content.sections.map(section => (
          <section key={section.id} id={section.id} className="mb-10 scroll-mt-6">
            <div className="flex items-center gap-2.5 mb-3">
              <h2 className="text-[11px] uppercase tracking-[0.15em] font-semibold shrink-0" style={{ color: C.muted }}>{section.title}</h2>
              <div className="flex-1 h-px" style={{ background: C.border }} />
            </div>
            {section.intro && <p className="text-[11px] mb-4 leading-relaxed" style={{ color: C.muted }}>{section.intro}</p>}
            {section.blocks.map((block, i) => (
              <BlockRenderer key={`${section.id}-${i}`} block={block} />
            ))}
          </section>
        ))}

        <footer className="pt-6 text-center text-[10px] tracking-wider" style={{ color: C.muted, borderTop: `1px solid ${C.border}` }}>
          KiComanda · {content.slug} · não indexado · não compartilhar externamente
        </footer>
      </div>
    </div>
  )
}
