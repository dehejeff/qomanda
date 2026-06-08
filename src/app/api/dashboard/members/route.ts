import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOwnerAccess, RestaurantAuthError } from '@/lib/restaurant-auth'

const ALLOWED_ROLES = ['waiter', 'kitchen', 'manager', 'caixa', 'recepcionista']
const MIN_PASSWORD = 6

function isValidPassword(pw: unknown): pw is string {
  return typeof pw === 'string' && pw.length >= MIN_PASSWORD
}

/** Localiza um usuário Auth por e-mail (paginando — GoTrue não filtra por e-mail no SDK). */
async function findAuthUserByEmail(admin: SupabaseClient, email: string): Promise<string | null> {
  const target = email.toLowerCase()
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error || !data?.users?.length) return null
    const found = data.users.find(u => (u.email ?? '').toLowerCase() === target)
    if (found) return found.id
    if (data.users.length < 1000) return null
  }
  return null
}

/**
 * Garante um usuário Auth para o e-mail com a senha informada.
 * Cria se não existir; se já existir, atualiza a senha. Retorna o id ou erro.
 */
async function ensureAuthUser(
  admin: SupabaseClient,
  email: string,
  password: string,
  name: string | null,
): Promise<{ userId: string } | { error: string }> {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: name ? { name } : undefined,
  })
  if (data?.user) return { userId: data.user.id }

  // E-mail já registrado → localiza e redefine a senha.
  if (error?.message?.toLowerCase().includes('already') || error?.message?.toLowerCase().includes('registered')) {
    const existingId = await findAuthUserByEmail(admin, email)
    if (!existingId) return { error: 'E-mail já cadastrado em outra conta.' }
    const { error: updErr } = await admin.auth.admin.updateUserById(existingId, { password })
    if (updErr) return { error: 'Não foi possível definir a senha.' }
    return { userId: existingId }
  }
  return { error: error?.message ?? 'Erro ao criar acesso.' }
}

export async function GET() {
  try {
    const access = await requireOwnerAccess()
    const admin = createAdminClient()

    const { data, error } = await admin
      .from('restaurant_members')
      .select('id, email, name, role, active, user_id, created_at')
      .eq('restaurant_id', access.restaurantId)
      .order('created_at')

    if (error) throw error
    const members = (data ?? []).map(m => ({
      id: m.id, email: m.email, name: m.name, role: m.role, active: m.active,
      has_login: Boolean(m.user_id), created_at: m.created_at,
    }))
    return NextResponse.json({ members })
  } catch (err) {
    if (err instanceof RestaurantAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: 'Erro ao listar equipe.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const access = await requireOwnerAccess()
    const body = await req.json() as { email?: string; name?: string; role?: string; password?: string }

    const email = body.email?.trim().toLowerCase()
    if (!email) {
      return NextResponse.json({ error: 'E-mail obrigatório.' }, { status: 400 })
    }

    const role = body.role ?? 'waiter'
    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Perfil inválido.' }, { status: 400 })
    }

    // Senha opcional na criação; quando informada, cria o acesso (login) do membro.
    const wantsLogin = body.password != null && body.password !== ''
    if (wantsLogin && !isValidPassword(body.password)) {
      return NextResponse.json({ error: `A senha deve ter ao menos ${MIN_PASSWORD} caracteres.` }, { status: 400 })
    }

    const admin = createAdminClient()
    const name = body.name?.trim() || null

    let userId: string | null = null
    if (wantsLogin) {
      const result = await ensureAuthUser(admin, email, body.password as string, name)
      if ('error' in result) {
        return NextResponse.json({ error: result.error }, { status: 400 })
      }
      userId = result.userId
    }

    const { data, error } = await admin
      .from('restaurant_members')
      .upsert({
        restaurant_id: access.restaurantId,
        email,
        name,
        role,
        active: true,
        ...(userId ? { user_id: userId } : {}),
      }, { onConflict: 'restaurant_id,email' })
      .select('id, email, name, role, active, user_id, created_at')
      .single()

    if (error) {
      return NextResponse.json({ error: 'Erro ao adicionar membro.' }, { status: 400 })
    }

    return NextResponse.json({
      ok: true,
      member: { id: data.id, email: data.email, name: data.name, role: data.role, active: data.active, has_login: Boolean(data.user_id), created_at: data.created_at },
    })
  } catch (err) {
    if (err instanceof RestaurantAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: 'Erro ao salvar membro.' }, { status: 500 })
  }
}

/**
 * PATCH — redefine senha e/ou ativa/inativa um membro.
 * Body: { memberId, password?, active? }
 */
export async function PATCH(req: NextRequest) {
  try {
    const access = await requireOwnerAccess()
    const body = await req.json() as { memberId?: string; password?: string; active?: boolean }
    if (!body.memberId) {
      return NextResponse.json({ error: 'memberId obrigatório.' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Escopa o membro ao restaurante do dono (evita acesso cruzado).
    const { data: member } = await admin
      .from('restaurant_members')
      .select('id, email, name, role, user_id')
      .eq('id', body.memberId)
      .eq('restaurant_id', access.restaurantId)
      .maybeSingle()

    if (!member) {
      return NextResponse.json({ error: 'Membro não encontrado.' }, { status: 404 })
    }
    if (member.role === 'owner') {
      return NextResponse.json({ error: 'A conta do proprietário não pode ser alterada aqui.' }, { status: 403 })
    }

    const updates: { active?: boolean; user_id?: string } = {}

    // Redefinir senha (cria o acesso se ainda não existir).
    if (body.password != null && body.password !== '') {
      if (!isValidPassword(body.password)) {
        return NextResponse.json({ error: `A senha deve ter ao menos ${MIN_PASSWORD} caracteres.` }, { status: 400 })
      }
      if (member.user_id) {
        const { error: updErr } = await admin.auth.admin.updateUserById(member.user_id, { password: body.password })
        if (updErr) return NextResponse.json({ error: 'Não foi possível redefinir a senha.' }, { status: 400 })
      } else {
        const result = await ensureAuthUser(admin, member.email, body.password, member.name)
        if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })
        updates.user_id = result.userId
      }
    }

    // Ativar/inativar — RLS/acesso exigem active=true, então inativar bloqueia o login.
    if (typeof body.active === 'boolean') {
      updates.active = body.active
    }

    if (Object.keys(updates).length > 0) {
      const { error: dbErr } = await admin
        .from('restaurant_members')
        .update(updates)
        .eq('id', member.id)
        .eq('restaurant_id', access.restaurantId)
      if (dbErr) return NextResponse.json({ error: 'Erro ao atualizar membro.' }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof RestaurantAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: 'Erro ao atualizar membro.' }, { status: 500 })
  }
}
