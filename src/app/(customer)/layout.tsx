'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { pushNav, consumeGoingBack } from '@/lib/nav-history'

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const prevUrl = useRef<string | null>(null)

  useEffect(() => {
    const currentUrl = window.location.pathname + window.location.search
    if (prevUrl.current !== null && prevUrl.current !== currentUrl) {
      if (!consumeGoingBack()) {
        pushNav(prevUrl.current)
      }
    }
    prevUrl.current = currentUrl
  }, [pathname])

  return (
    <div className="min-h-screen" style={{ background: '#0D1117' }}>
      {children}
    </div>
  )
}
