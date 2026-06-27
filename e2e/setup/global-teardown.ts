/**
 * Playwright global teardown — removes all test data created by global-setup.ts
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, unlinkSync } from 'fs'

export default async function globalTeardown() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return

  let ctx: {
    restaurantId: string
    ownerUserId: string
    waiterUserId: string
    slug: string
  }

  try {
    ctx = JSON.parse(readFileSync('e2e/.test-run-context.json', 'utf8'))
  } catch {
    console.warn('⚠️  teardown: no context file found, skipping cleanup')
    return
  }

  if (typeof globalThis.WebSocket === 'undefined') {
    const { WebSocket } = await import('ws' as string)
    ;(globalThis as unknown as Record<string, unknown>).WebSocket = WebSocket
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  console.log(`\n🧹 E2E teardown — restaurant: ${ctx.slug}`)

  // Delete restaurant (cascade deletes tables, menu_items, categories via FK)
  const { error: restErr } = await admin
    .from('restaurants')
    .delete()
    .eq('id', ctx.restaurantId)
  if (restErr) console.warn(`  ⚠️  restaurant delete: ${restErr.message}`)
  else console.log(`  ✅ restaurant deleted`)

  // Delete auth users
  const { error: ownerDelErr } = await admin.auth.admin.deleteUser(ctx.ownerUserId)
  if (ownerDelErr) console.warn(`  ⚠️  owner delete: ${ownerDelErr.message}`)
  else console.log(`  ✅ owner user deleted`)

  const { error: waiterDelErr } = await admin.auth.admin.deleteUser(ctx.waiterUserId)
  if (waiterDelErr) console.warn(`  ⚠️  waiter delete: ${waiterDelErr.message}`)
  else console.log(`  ✅ waiter user deleted`)

  // Remove temp context file
  try {
    unlinkSync('e2e/.test-run-context.json')
  } catch {
    // ignore
  }

  console.log('  ✅ teardown complete\n')
}
