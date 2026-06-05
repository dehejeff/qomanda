'use client'

import { useEffect, useMemo, useState } from 'react'
import { PLAYBOOK } from '@/lib/internal-playbook'

const STORAGE_KEY = 'qomanda_playbook_checks'

/** Conteúdo do playbook (implementação + suporte). Reutilizado na página
 *  escondida /internal/playbook e embutido na aba Playbook do Suporte. */
export function PlaybookContent({ heading = true }: { heading?: boolean }) {
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try { setChecked(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')) } catch { /* ignore */ }
    setHydrated(true)
  }, [])

  function toggle(id: string) {
    setChecked(prev => {
      const next = { ...prev, [id]: !prev[id] }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }
  function clearAll() {
    setChecked({})
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
  }

  const allItemIds = useMemo(
    () => PLAYBOOK.flatMap(p => p.sections.flatMap(s => s.items.map((_, i) => `${s.id}.${i}`))),
    [],
  )
  const doneCount = allItemIds.filter(id => checked[id]).length

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          {heading ? (
            <>
              <p className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant">Interno · time de implementação e suporte</p>
              <h1 className="text-2xl font-black text-on-surface mt-1">Playbook</h1>
            </>
          ) : (
            <h2 className="text-lg font-semibold text-on-surface">Playbook — implementação & suporte</h2>
          )}
          <p className="text-sm text-on-surface-variant mt-1">
            Configuração de novos restaurantes/bares e suporte à operação. Marcações ficam salvas neste navegador.
          </p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <span className="text-xs font-mono text-on-surface-variant">{doneCount}/{allItemIds.length}</span>
          <button type="button" onClick={clearAll} className="px-3 py-1.5 rounded-lg text-xs font-mono border border-outline-variant text-on-surface-variant hover:text-on-surface">
            Limpar
          </button>
          <button type="button" onClick={() => window.print()} className="px-3 py-1.5 rounded-lg text-xs font-mono border border-outline-variant text-on-surface-variant hover:text-on-surface flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px]">print</span> Imprimir
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-8">
        {/* TOC */}
        <nav className="hidden lg:block sticky top-8 self-start space-y-4 print:hidden">
          {PLAYBOOK.map(part => (
            <div key={part.id}>
              <p className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant mb-1">{part.title.split(' — ')[0]}</p>
              <ul className="space-y-0.5">
                {part.sections.map(s => (
                  <li key={s.id}>
                    <a href={`#${s.id}`} className="text-xs text-on-surface-variant hover:text-primary block py-0.5 truncate">{s.title}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* Conteúdo */}
        <div className="space-y-10 min-w-0">
          {PLAYBOOK.map(part => (
            <section key={part.id}>
              <div className="flex items-center gap-2.5 mb-1">
                <span className="material-symbols-outlined text-primary">{part.icon}</span>
                <h2 className="text-xl font-bold text-on-surface">{part.title}</h2>
              </div>
              <p className="text-sm text-on-surface-variant mb-5">{part.subtitle}</p>

              <div className="space-y-5">
                {part.sections.map(section => (
                  <div key={section.id} id={section.id} className="scroll-mt-8 bg-surface-container border border-outline-variant rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-on-surface">{section.title}</h3>
                    {section.intro && <p className="text-xs text-on-surface-variant mt-1 mb-3">{section.intro}</p>}
                    <ul className={`space-y-2 ${section.intro ? '' : 'mt-3'}`}>
                      {section.items.map((item, i) => {
                        const id = `${section.id}.${i}`
                        const isOn = hydrated && checked[id]
                        return (
                          <li key={id}>
                            <button type="button" onClick={() => toggle(id)} className="flex items-start gap-2.5 text-left w-full group">
                              <span className={`mt-0.5 w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors ${isOn ? 'bg-primary border-primary' : 'border-outline-variant group-hover:border-primary'}`}>
                                {isOn && <span className="material-symbols-outlined text-[12px] text-on-primary">check</span>}
                              </span>
                              <span className="min-w-0">
                                <span className={`text-sm ${isOn ? 'text-on-surface-variant line-through' : 'text-on-surface'}`}>{item.text}</span>
                                {item.hint && <span className="block text-[11px] text-on-surface-variant mt-0.5">{item.hint}</span>}
                              </span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          ))}

          <p className="text-[11px] text-on-surface-variant print:hidden">
            Referências: <span className="font-mono">docs/GO-LIVE-CHECKLIST.md</span> · <span className="font-mono">docs/DOCUMENTACAO.md</span> · painel <span className="font-mono">/internal/health</span>.
          </p>
        </div>
      </div>
    </div>
  )
}
