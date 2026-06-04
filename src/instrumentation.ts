import type { Instrumentation } from 'next'

/** Inicializa observabilidade no boot do servidor (no-op sem SENTRY_DSN). */
export async function register(): Promise<void> {
  const { initObservability } = await import('@/lib/observability')
  await initObservability()
}

/** Captura erros de server (route handlers, server components) no Sentry. */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const { captureRequestError } = await import('@/lib/observability')
  await captureRequestError(
    err,
    { path: request.path, method: request.method },
    { routerKind: context.routerKind, routePath: context.routePath, renderSource: context.renderSource },
  )
}
