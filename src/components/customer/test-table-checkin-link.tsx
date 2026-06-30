'use client'

import Link from 'next/link'
import { getTestTableCheckInPath, isTestTableCheckInEnabled, TEST_TABLE_NUMBER, TEST_TABLE_SLUG } from '@/lib/test-table-checkin'

type Props = {
  variant?: 'button' | 'inline'
}

export function TestTableCheckInLink({ variant = 'button' }: Props) {
  if (!isTestTableCheckInEnabled()) return null

  const href = getTestTableCheckInPath()

  if (variant === 'inline') {
    return (
      <Link href={href} className="underline underline-offset-2" style={{ color: '#00E676' }}>
        Mesa {TEST_TABLE_NUMBER} ({TEST_TABLE_SLUG})
      </Link>
    )
  }

  return (
    <div className="w-full flex flex-col items-center space-y-2">
      <div className="flex items-center gap-4 w-full">
        <div className="h-px flex-1" style={{ background: '#30363D' }} />
        <span className="text-[11px] font-mono uppercase tracking-widest text-center" style={{ color: '#8B949E' }}>Teste</span>
        <div className="h-px flex-1" style={{ background: '#30363D' }} />
      </div>
      <a href={href}
        className="w-full h-12 flex items-center justify-center gap-2 text-sm font-mono rounded-xl active:scale-95 transition-all text-center"
        style={{ background: '#161B22', border: '1px dashed #30363D', color: '#00E676', fontWeight: 600 }}>
        <span className="material-symbols-outlined text-[18px]">science</span>
        Entrar na Mesa {TEST_TABLE_NUMBER} (teste)
      </a>
      <p className="text-[10px] font-mono text-center leading-relaxed" style={{ color: '#30363D' }}>
        Só visível em ambiente de testes
      </p>
    </div>
  )
}
