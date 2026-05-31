import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { bankLabel, maskBankAccount } from '@/lib/brazil-banks'
import { provisionDigitalPayoutIfNeeded, type BankAccountPayload } from '@/lib/provision-payout-account'

function digitsOnly(value: string) {
  return value.replace(/\D/g, '')
}

function validateBankPayload(body: Record<string, unknown>): BankAccountPayload | string {
  const holderName = String(body.holderName ?? '').trim()
  const document = digitsOnly(String(body.document ?? ''))
  const bankCode = digitsOnly(String(body.bankCode ?? ''))
  const bankName = String(body.bankName ?? '').trim()
  const agency = digitsOnly(String(body.agency ?? ''))
  const account = digitsOnly(String(body.account ?? ''))
  const accountDigit = digitsOnly(String(body.accountDigit ?? ''))
  const accountType = body.accountType === 'savings' ? 'savings' : 'checking'

  if (!holderName) return 'Informe o titular da conta.'
  if (document.length !== 11 && document.length !== 14) return 'CPF ou CNPJ inválido.'
  if (!bankCode || bankCode.length < 3) return 'Selecione o banco.'
  if (!agency || agency.length < 3) return 'Agência inválida.'
  if (!account || account.length < 4) return 'Conta inválida.'
  if (!accountDigit) return 'Informe o dígito da conta.'

  return {
    holderName,
    document,
    bankCode,
    bankName,
    agency,
    account,
    accountDigit,
    accountType,
  }
}

export type PayoutBankAccountDto = {
  configured: boolean
  holderName: string | null
  document: string | null
  bankCode: string | null
  bankName: string | null
  bankAgency: string | null
  bankAccountMasked: string | null
  accountType: 'checking' | 'savings' | null
  configuredAt: string | null
  digitalStatus: 'inactive' | 'pending' | 'active'
  digitalStatusLabel: string
}

function mapDigitalStatus(walletId: string | null, onboardingStatus: string | null): Pick<PayoutBankAccountDto, 'digitalStatus' | 'digitalStatusLabel'> {
  if (walletId && onboardingStatus === 'approved') {
    return { digitalStatus: 'active', digitalStatusLabel: 'Qomanda Pay ativo' }
  }
  if (walletId || onboardingStatus === 'submitted') {
    return { digitalStatus: 'pending', digitalStatusLabel: 'Em análise' }
  }
  return { digitalStatus: 'inactive', digitalStatusLabel: 'Aguardando cadastro bancário' }
}

/**
 * GET /api/dashboard/payout/bank-account
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

    const { data: restaurant } = await supabase
      .from('restaurants')
      .select(`
        payout_holder_name, payout_document,
        bank_code, bank_name, bank_agency, bank_account, bank_account_digit, bank_account_type,
        payout_configured_at, asaas_wallet_id, asaas_onboarding_status
      `)
      .eq('owner_id', user.id)
      .single()

    if (!restaurant) return NextResponse.json({ error: 'Restaurante não encontrado.' }, { status: 404 })

    const configured = Boolean(restaurant.bank_account)
    const digital = mapDigitalStatus(restaurant.asaas_wallet_id, restaurant.asaas_onboarding_status)

    const dto: PayoutBankAccountDto = {
      configured,
      holderName: restaurant.payout_holder_name,
      document: restaurant.payout_document,
      bankCode: restaurant.bank_code,
      bankName: restaurant.bank_name,
      bankAgency: restaurant.bank_agency,
      bankAccountMasked: configured
        ? maskBankAccount(restaurant.bank_account!, restaurant.bank_account_digit)
        : null,
      accountType: (restaurant.bank_account_type as 'checking' | 'savings' | null) ?? null,
      configuredAt: restaurant.payout_configured_at,
      ...digital,
    }

    return NextResponse.json({ account: dto })
  } catch (err) {
    console.error('[Payout bank GET]', err)
    return NextResponse.json({ error: 'Erro ao carregar conta bancária.' }, { status: 500 })
  }
}

/**
 * POST /api/dashboard/payout/bank-account
 * Restaurante informa conta de repasse (estilo iFood).
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

    const body = await req.json()
    const validated = validateBankPayload(body)
    if (typeof validated === 'string') {
      return NextResponse.json({ error: validated }, { status: 400 })
    }

    const { data: restaurant } = await supabase
      .from('restaurants')
      .select(`
        id, name, address, phone, asaas_wallet_id,
        legal_name, document_number, company_type, contact_email,
        address_street, address_number, address_neighborhood, address_postal_code,
        estimated_monthly_revenue
      `)
      .eq('owner_id', user.id)
      .single()

    if (!restaurant) return NextResponse.json({ error: 'Restaurante não encontrado.' }, { status: 404 })

    const now = new Date().toISOString()
    const resolvedBankName = validated.bankName || bankLabel(validated.bankCode, null)

    const { error: updateErr } = await supabase
      .from('restaurants')
      .update({
        payout_holder_name: validated.holderName,
        payout_document: validated.document,
        bank_code: validated.bankCode,
        bank_name: resolvedBankName,
        bank_agency: validated.agency,
        bank_account: validated.account,
        bank_account_digit: validated.accountDigit,
        bank_account_type: validated.accountType,
        payout_configured_at: now,
      })
      .eq('id', restaurant.id)

    if (updateErr) {
      console.error('[Payout bank save]', updateErr)
      return NextResponse.json({ error: 'Erro ao salvar conta bancária.' }, { status: 500 })
    }

    const provision = await provisionDigitalPayoutIfNeeded(
      supabase,
      restaurant,
      validated,
      user.email ?? null,
    )

    const { data: refreshed } = await supabase
      .from('restaurants')
      .select('asaas_wallet_id, asaas_onboarding_status, payout_configured_at, bank_name, bank_agency, bank_account, bank_account_digit, bank_account_type, payout_holder_name, payout_document, bank_code')
      .eq('id', restaurant.id)
      .single()

    const digital = mapDigitalStatus(
      refreshed?.asaas_wallet_id ?? null,
      refreshed?.asaas_onboarding_status ?? null,
    )

    return NextResponse.json({
      ok: true,
      provisioned: provision.provisioned,
      message: provision.provisioned
        ? 'Conta bancária salva. Qomanda Pay em processo de ativação.'
        : 'Conta bancária salva. Validaremos os dados para liberar PIX e cartão em breve.',
      account: {
        configured: true,
        holderName: refreshed?.payout_holder_name ?? validated.holderName,
        document: refreshed?.payout_document ?? validated.document,
        bankCode: refreshed?.bank_code ?? validated.bankCode,
        bankName: refreshed?.bank_name ?? resolvedBankName,
        bankAgency: refreshed?.bank_agency ?? validated.agency,
        bankAccountMasked: maskBankAccount(validated.account, validated.accountDigit),
        accountType: validated.accountType,
        configuredAt: refreshed?.payout_configured_at ?? now,
        ...digital,
      } satisfies PayoutBankAccountDto,
    })
  } catch (err) {
    console.error('[Payout bank POST]', err)
    return NextResponse.json({ error: 'Erro ao salvar conta bancária.' }, { status: 500 })
  }
}
