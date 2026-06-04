/**
 * Observabilidade client-side (Sentry browser).
 * Degradável: sem NEXT_PUBLIC_SENTRY_DSN, não importa o SDK nem inicializa nada.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  import('@sentry/browser')
    .then(Sentry => {
      Sentry.init({
        dsn,
        environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',
        tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? 0),
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 0,
      })
    })
    .catch(err => console.error('[observability:client] init falhou', err))
}

// Captura de navegação (router transitions) — opcional, no-op se SDK ausente.
export function onRouterTransitionStart() {}
