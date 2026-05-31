/**
 * Cria (ou atualiza) as contas da equipe Qomanda no Supabase Auth + staff_users.
 *
 * Uso:
 *   node scripts/setup-internal-staff.mjs
 *   STAFF_PASSWORD='SuaSenhaSegura123' node scripts/setup-internal-staff.mjs
 *
 * Requer: NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local
 * (carregados via dotenv se disponível, ou exportados no shell)
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

const STAFF = [
  { email: 'jeff@qomanda.com', name: 'Jeff', role: 'superadmin' },
  { email: 'daniel@qomanda.com', name: 'Daniel', role: 'superadmin' },
]

function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
    for (const line of raw.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq)
      const val = trimmed.slice(eq + 1)
      if (!process.env[key]) process.env[key] = val
    }
  } catch {
    // .env.local opcional se vars já exportadas
  }
}

loadEnvLocal()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const password = process.env.STAFF_PASSWORD ?? 'Qomanda2026!'

if (!url || !key) {
  console.error('Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}

const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

async function findUserByEmail(email) {
  let page = 1
  while (page <= 10) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const found = data.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
    if (found) return found
    if (data.users.length < 200) break
    page++
  }
  return null
}

async function main() {
  console.log('Configurando equipe Qomanda...\n')

  for (const person of STAFF) {
    let user = await findUserByEmail(person.email)

    if (!user) {
      const { data, error } = await admin.auth.admin.createUser({
        email: person.email,
        password,
        email_confirm: true,
        user_metadata: { name: person.name },
      })
      if (error) {
        console.error(`✗ ${person.email}: ${error.message}`)
        continue
      }
      user = data.user
      console.log(`✓ Conta criada: ${person.email}`)
    } else {
      const { error } = await admin.auth.admin.updateUserById(user.id, {
        password,
        email_confirm: true,
      })
      if (error) console.warn(`  Aviso ao atualizar senha de ${person.email}: ${error.message}`)
      else console.log(`✓ Conta já existia: ${person.email} (senha atualizada)`)
    }

    const { error: staffErr } = await admin.from('staff_users').upsert(
      {
        user_id: user.id,
        email: person.email,
        name: person.name,
        role: person.role,
        active: true,
      },
      { onConflict: 'user_id' },
    )

    if (staffErr) {
      if (staffErr.message.includes('staff_users') || staffErr.code === '42P01') {
        console.warn(`  staff_users ainda não existe — rode migrate-internal-portal.sql no Supabase.`)
        console.warn(`  Enquanto isso, QOMANDA_STAFF_EMAILS no .env já libera o acesso.`)
      } else {
        console.error(`  Erro staff_users: ${staffErr.message}`)
      }
    } else {
      console.log(`  → Registrado em staff_users (${person.role})`)
    }
  }

  console.log('\n---')
  console.log('Login: https://SEU_DOMINIO/internal/login')
  console.log(`Senha inicial (ambos): ${password}`)
  console.log('Troque a senha depois no Supabase → Authentication → Users.')
  console.log('\nLembre de adicionar na Vercel:')
  console.log('QOMANDA_STAFF_EMAILS=jeff@qomanda.com,daniel@qomanda.com')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
