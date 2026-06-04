/**
 * Observabilidade (Sentry) — server-side.
 *
 * Degradável e lazy: sem SENTRY_DSN, tudo vira no-op (apenas console.error) e o
 * SDK NUNCA é importado. Com DSN, inicializa o @sentry/node sob demanda. Não usa
 * o plugin de build do Sentry (compatível com Turbopack/next-pwa do Next 16).
 */
type SentryNode = typeof import('@sentry/node')

let sentry: SentryNode | null = null
let initTried = false

async function getSentry(): Promise<SentryNode | null> {
  if (initTried) return sentry
  initTried = true

  const dsn = process.env.SENTRY_DSN
  // @sentry/node não roda no runtime edge — só inicializa no Node.
  if (!dsn || process.env.NEXT_RUNTIME === 'edge') return null

  try {
    const Sentry = await import('@sentry/node')
    if (!Sentry.getClient()) {
      Sentry.init({
        dsn,
        environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',
        tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0),
        release: process.env.VERCEL_GIT_COMMIT_SHA,
      })
    }
    sentry = Sentry
  } catch (err) {
    console.error('[observability] init falhou', err)
    sentry = null
  }
  return sentry
}

/** Inicializa proativamente (chamado em instrumentation.register). */
export async function initObservability(): Promise<void> {
  await getSentry()
}

/**
 * Registra um erro. Sempre loga no console; envia ao Sentry quando configurado.
 * `scope` ajuda a agrupar (ex.: 'webhook:asaas', 'job:nfe_emit').
 */
export async function captureError(
  err: unknown,
  context?: { scope?: string; extra?: Record<string, unknown> },
): Promise<void> {
  console.error(`[error]${context?.scope ? ' ' + context.scope : ''}`, err)
  const S = await getSentry()
  if (!S) return
  try {
    S.withScope(scope => {
      if (context?.scope) scope.setTag('scope', context.scope)
      if (context?.extra) scope.setExtras(context.extra)
      S.captureException(err instanceof Error ? err : new Error(String(err)))
    })
  } catch { /* nunca deixa a observabilidade quebrar o fluxo */ }
}

type RequestErrorRequest = { path?: string; method?: string }
type RequestErrorContext = { routerKind?: string; routePath?: string; renderSource?: string }

/** Adapta o hook onRequestError do Next para o Sentry. */
export async function captureRequestError(
  err: unknown,
  request: RequestErrorRequest,
  ctx: RequestErrorContext,
): Promise<void> {
  await captureError(err, {
    scope: `request:${request.method ?? 'GET'} ${ctx.routePath ?? request.path ?? '?'}`,
    extra: { path: request.path, method: request.method, routerKind: ctx.routerKind, renderSource: ctx.renderSource },
  })
}

export function isObservabilityConfigured(): boolean {
  return Boolean(process.env.SENTRY_DSN)
}
