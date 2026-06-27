/**
 * Playwright global setup — creates isolated test data before the suite runs.
 *
 * Creates:
 *   - one admin user  (TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD in process.env)
 *   - one restaurant  (slug stored in process.env.TEST_SLUG)
 *   - one table       (mesa "01", token stored in process.env.TEST_TABLE_TOKEN)
 *   - a few menu categories + items
 *
 * All records are tagged with a unique STAMP so teardown can remove them safely.
 */

import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

const STAMP = Date.now()
const SLUG = `e2e-test-${STAMP}`
const OWNER_EMAIL = `e2e-owner-${STAMP}@qomanda-test.com`
const WAITER_EMAIL = `e2e-waiter-${STAMP}@qomanda-test.com`
const PASSWORD = 'E2eTest@2026'

export default async function globalSetup() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
  }

  // Polyfill WebSocket for Node
  if (typeof globalThis.WebSocket === 'undefined') {
    const { WebSocket } = await import('ws' as string)
    ;(globalThis as unknown as Record<string, unknown>).WebSocket = WebSocket
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  console.log(`\n🔧 E2E setup — stamp ${STAMP}`)

  // 1. Create owner auth user
  const { data: ownerAuth, error: ownerErr } = await admin.auth.admin.createUser({
    email: OWNER_EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { name: 'E2E Owner' },
  })
  if (ownerErr) throw new Error(`Owner user: ${ownerErr.message}`)
  console.log(`  ✅ owner auth: ${OWNER_EMAIL}`)

  // 2. Create restaurant
  const { data: restaurant, error: restErr } = await admin
    .from('restaurants')
    .insert({
      owner_id: ownerAuth.user.id,
      name: `E2E Restaurante ${STAMP}`,
      slug: SLUG,
      operational_mode: 'dine_in',
      restaurant_model: 'salao',
      payment_gateway_provider: 'manual',
      manual_pix_key: '11999999999',
    })
    .select('id')
    .single()
  if (restErr) throw new Error(`Restaurant: ${restErr.message}`)
  const restaurantId = restaurant.id
  console.log(`  ✅ restaurant: ${SLUG} (${restaurantId})`)

  // 3. Create a table — check_in_token is UUID type
  const tableToken = randomUUID()
  const { error: tableErr } = await admin.from('tables').insert({
    restaurant_id: restaurantId,
    number: '01',
    check_in_token: tableToken,
    status: 'free',
  })
  if (tableErr) throw new Error(`Table: ${tableErr.message}`)
  console.log(`  ✅ table 01, token=${tableToken}`)

  // 4. Create menu category + items
  const { data: category, error: catErr } = await admin
    .from('menu_categories')
    .insert({ restaurant_id: restaurantId, name: 'Pratos E2E', display_order: 0 })
    .select('id')
    .single()
  if (catErr) throw new Error(`Category: ${catErr.message}`)

  const { error: itemsErr } = await admin.from('menu_items').insert([
    {
      restaurant_id: restaurantId,
      category_id: category.id,
      name: 'Item E2E 1',
      price: 25.00,
      available: true,
    },
    {
      restaurant_id: restaurantId,
      category_id: category.id,
      name: 'Item E2E 2',
      price: 30.00,
      available: true,
    },
  ])
  if (itemsErr) throw new Error(`Menu items: ${itemsErr.message}`)
  console.log(`  ✅ menu: 2 items`)

  // 5. Create waiter user
  const { data: waiterAuth, error: waiterErr } = await admin.auth.admin.createUser({
    email: WAITER_EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { name: 'E2E Waiter' },
  })
  if (waiterErr) throw new Error(`Waiter user: ${waiterErr.message}`)

  const { error: waiterMemberErr } = await admin.from('restaurant_members').insert({
    restaurant_id: restaurantId,
    user_id: waiterAuth.user.id,
    email: WAITER_EMAIL,
    name: 'E2E Waiter',
    role: 'waiter',
    active: true,
  })
  if (waiterMemberErr) {
    // Non-fatal if table doesn't exist yet
    console.warn(`  ⚠️  waiter member insert: ${waiterMemberErr.message}`)
  } else {
    console.log(`  ✅ waiter: ${WAITER_EMAIL}`)
  }

  // 6. Expose to tests via env
  process.env.TEST_SLUG = SLUG
  process.env.TEST_RESTAURANT_ID = restaurantId
  process.env.TEST_TABLE_TOKEN = tableToken
  process.env.TEST_OWNER_ID = ownerAuth.user.id
  process.env.TEST_WAITER_ID = waiterAuth.user.id
  process.env.TEST_ADMIN_EMAIL = OWNER_EMAIL
  process.env.TEST_WAITER_EMAIL = WAITER_EMAIL
  process.env.TEST_PASSWORD = PASSWORD

  // Persist to a temp file so teardown can read them (process.env doesn't survive separate process)
  const { writeFileSync } = await import('fs')
  writeFileSync(
    'e2e/.test-run-context.json',
    JSON.stringify({
      slug: SLUG,
      restaurantId,
      tableToken,
      ownerUserId: ownerAuth.user.id,
      waiterUserId: waiterAuth.user.id,
      adminEmail: OWNER_EMAIL,
      waiterEmail: WAITER_EMAIL,
      password: PASSWORD,
    }),
    'utf8',
  )

  console.log(`  ✅ context saved to e2e/.test-run-context.json\n`)
}
