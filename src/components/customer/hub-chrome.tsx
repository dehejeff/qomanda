'use client'

import Link from 'next/link'
import { QomandaLogo } from '@/components/qomanda-logo'

export function HubPageHeader({ title, backHref }: { title?: string; backHref?: string }) {
  return (
    <header className="sticky top-0 z-40 px-6 h-16 flex items-center justify-between"
      style={{ background: 'rgba(11,19,38,0.92)', borderBottom: '1px solid rgba(88,66,55,0.35)', backdropFilter: 'blur(12px)' }}>
      {backHref ? (
        <Link href={backHref} className="p-2 -ml-2 rounded-full" style={{ color: '#ffb690' }}>
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
      ) : (
        <div className="flex items-center gap-2.5">
          <QomandaLogo size={28} />
          <span className="font-black text-base" style={{ fontFamily: 'Geist, sans-serif', letterSpacing: '-0.02em' }}>KiComanda</span>
        </div>
      )}
      {title ? (
        <h1 className="text-sm font-semibold font-mono absolute left-1/2 -translate-x-1/2">{title}</h1>
      ) : null}
      <div className="w-8" />
    </header>
  )
}

export function RestaurantAvatar({ name, logoUrl, size = 44 }: { name: string; logoUrl: string | null; size?: number }) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={logoUrl} alt={name} className="rounded-xl object-cover shrink-0"
        style={{ width: size, height: size, border: '1px solid #334155' }} />
    )
  }
  return (
    <div className="rounded-xl flex items-center justify-center shrink-0 font-bold"
      style={{ width: size, height: size, background: '#1e293b', border: '1px solid #334155', color: '#ffb690', fontSize: size * 0.35 }}>
      {name.charAt(0).toUpperCase()}
    </div>
  )
}
