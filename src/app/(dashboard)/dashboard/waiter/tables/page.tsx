'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type TableRow = { id: string; number: string; status: string }

export default function WaiterTablesPage() {
  const [tables, setTables] = useState<TableRow[]>([])

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: restaurant } = await supabase
        .from('restaurants')
        .select('id')
        .eq('owner_id', user.id)
        .maybeSingle()

      let restaurantId = restaurant?.id
      if (!restaurantId && user.email) {
        const { data: member } = await supabase
          .from('restaurant_members')
          .select('restaurant_id')
          .eq('email', user.email.toLowerCase())
          .maybeSingle()
        restaurantId = member?.restaurant_id
      }
      if (!restaurantId) return

      const { data } = await supabase
        .from('tables')
        .select('id, number, status')
        .eq('restaurant_id', restaurantId)
        .neq('number', 'BALCAO')
        .order('number')

      setTables(data ?? [])
    }
    load()
  }, [])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black text-on-surface">Mesas</h1>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {tables.map(t => (
          <div
            key={t.id}
            className={`rounded-xl border p-4 text-center ${
              t.status === 'occupied'
                ? 'border-primary bg-primary/10'
                : 'border-outline-variant bg-surface-container'
            }`}
          >
            <p className="text-xs font-mono uppercase text-on-surface-variant">Mesa</p>
            <p className="text-2xl font-black text-on-surface">{t.number}</p>
            <p className="text-[10px] font-mono mt-1 text-on-surface-variant">{t.status}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
