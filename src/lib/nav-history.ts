const STACK_KEY = '_nav_stack'
const IS_BACK_KEY = '_nav_going_back'

export function pushNav(url: string) {
  if (typeof window === 'undefined') return
  try {
    const stack: string[] = JSON.parse(sessionStorage.getItem(STACK_KEY) || '[]')
    stack.push(url)
    if (stack.length > 15) stack.shift()
    sessionStorage.setItem(STACK_KEY, JSON.stringify(stack))
  } catch {}
}

/** Remove e retorna a URL anterior da pilha de navegação. */
export function popNav(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const stack: string[] = JSON.parse(sessionStorage.getItem(STACK_KEY) || '[]')
    const url = stack.pop() ?? null
    sessionStorage.setItem(STACK_KEY, JSON.stringify(stack))
    if (url) sessionStorage.setItem(IS_BACK_KEY, '1')
    return url
  } catch { return null }
}

/** Checa (e consome) o flag de navegação para trás — usado pelo layout para evitar repush. */
export function consumeGoingBack(): boolean {
  if (typeof window === 'undefined') return false
  const v = sessionStorage.getItem(IS_BACK_KEY) === '1'
  if (v) sessionStorage.removeItem(IS_BACK_KEY)
  return v
}
