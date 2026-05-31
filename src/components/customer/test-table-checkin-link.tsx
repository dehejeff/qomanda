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
      <Link href={href} className="underline underline-offset-2" style={{ color: '#ffb690' }}>
        Mesa {TEST_TABLE_NUMBER} ({TEST_TABLE_SLUG})
      </Link>
    )
  }

  return (
    <div className="w-full max-w-xs space-y-2">
      <div className="flex items-center gap-4 w-full">
        <div className="h-px flex-1" style={{ background: '#584237' }} />
        <span className="text-[11px] font-mono uppercase tracking-widest" style={{ color: '#a78b7d' }}>Teste</span>
        <div className="h-px flex-1" style={{ background: '#584237' }} />
      </div>
      <Link href={href}
        className="w-full h-12 flex items-center justify-center gap-2 text-sm font-mono rounded-xl active:scale-95 transition-all"
        style={{ background: '#131b2e', border: '1px dashed #584237', color: '#ffb690', fontWeight: 600 }}>
        <span className="material-symbols-outlined text-[18px]">science</span>
        Entrar na Mesa {TEST_TABLE_NUMBER} (teste)
      </Link>
      <p className="text-[10px] font-mono text-center leading-relaxed px-2" style={{ color: '#584237' }}>
        Só visível em ambiente de testes
      </p>
    </div>
  )
}
