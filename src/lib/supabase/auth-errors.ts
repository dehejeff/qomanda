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
