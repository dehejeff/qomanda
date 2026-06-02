/** Erros de sessão Supabase que exigem limpar cookies locais (refresh token inválido/ausente). */
export function isInvalidRefreshTokenError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const message = 'message' in error ? String((error as { message: string }).message) : ''
  const status = 'status' in error ? Number((error as { status: number }).status) : 0
  if (status === 401 && message.toLowerCase().includes('refresh')) return true
  return (
    message.includes('Refresh Token Not Found')
    || message.includes('Invalid Refresh Token')
    || message.includes('refresh_token_not_found')
  )
}

/** Remove sessão local quando o refresh token não existe mais no servidor. */
export async function clearStaleAuthSession(
  supabase: { auth: { signOut: (opts?: { scope?: 'local' | 'global' | 'others' }) => Promise<{ error: unknown }> } },
): Promise<void> {
  await supabase.auth.signOut({ scope: 'local' })
}

/** Traduz erros de signup/login do Supabase para mensagens amigáveis em PT-BR. */
export function friendlyAuthError(error: unknown): string {
  if (!error || typeof error !== 'object') return 'Erro ao criar conta. Tente novamente.'
  const message = 'message' in error ? String((error as { message: string }).message) : ''
  const code = 'code' in error ? String((error as { code: string }).code) : ''
  const lower = message.toLowerCase()

  if (code === 'over_email_send_rate_limit' || lower.includes('rate limit')) {
    return 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.'
  }
  if (code === 'user_already_exists' || lower.includes('already registered') || lower.includes('already exists')) {
    return 'Este e-mail já está cadastrado. Faça login ou use outro e-mail.'
  }
  if (lower.includes('invalid') && lower.includes('email')) {
    return 'E-mail inválido. Verifique o endereço digitado.'
  }
  if (lower.includes('password') && (lower.includes('least') || lower.includes('6'))) {
    return 'A senha deve ter pelo menos 6 caracteres.'
  }
  if (lower.includes('invalid login credentials')) {
    return 'E-mail ou senha incorretos.'
  }
  return message || 'Erro ao criar conta. Tente novamente.'
}
