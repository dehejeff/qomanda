'use client'

import { useEffect } from 'react'
import { migrateClientStorage } from '@/lib/client-storage'

/** Migra chaves localStorage qomanda_* → kicomanda_* na primeira carga. */
export function ClientStorageBootstrap() {
  useEffect(() => {
    migrateClientStorage()
  }, [])
  return null
}
