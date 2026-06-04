'use client'

import { createContext, useContext, useMemo, useState } from 'react'

type DashboardSearchContextValue = {
  query: string
  setQuery: (query: string) => void
}

const DashboardSearchContext = createContext<DashboardSearchContextValue | null>(null)

export function DashboardSearchProvider({ children }: { children: React.ReactNode }) {
  const [query, setQuery] = useState('')

  const value = useMemo(() => ({ query, setQuery }), [query])

  return (
    <DashboardSearchContext.Provider value={value}>
      {children}
    </DashboardSearchContext.Provider>
  )
}

export function useDashboardSearch() {
  const ctx = useContext(DashboardSearchContext)
  if (!ctx) {
    throw new Error('useDashboardSearch must be used within DashboardSearchProvider')
  }
  return ctx
}

/** Retorna null fora do provider (ex.: testes). */
export function useDashboardSearchOptional() {
  return useContext(DashboardSearchContext)
}
