# Observabilidade (Sentry) — EM ANDAMENTO

> Status: **parcial** (parado em 2026-06-04). Integração degradável já no ar; falta
> wiring nos caminhos de background, variáveis de ambiente e validação com DSN real.

## Decisões de arquitetura

- **Sem o plugin de build do Sentry** (`withSentryConfig`) — evita conflito com
  Turbopack + next-pwa do Next 16. Usa a instrumentação **nativa** do Next.
- **Lazy + DSN-gated**: sem `SENTRY_DSN`, o SDK **nunca é importado** e tudo vira
  no-op (apenas `console.error`). Zero impacto no build/boot quando não configurado.
- SDKs oficiais: `@sentry/node` (server) e `@sentry/browser` (client), v9.

## O que já está pronto

| Item | Arquivo |
|------|---------|
| Camada de observabilidade (init lazy, `captureError`, `captureRequestError`, `initObservability`, `isObservabilityConfigured`) | `src/lib/observability.ts` |
| Instrumentação server: `register()` (init no boot) + `onRequestError` (captura erros de route handlers / server components) | `src/instrumentation.ts` |
| Instrumentação client: init do `@sentry/browser` se `NEXT_PUBLIC_SENTRY_DSN` | `src/instrumentation-client.ts` |
| Dependências instaladas | `@sentry/node@^9`, `@sentry/browser@^9` |

Verificado: typecheck limpo + dev server sobe e responde 200 (no-op sem DSN).

## O que falta (retomar daqui)

1. **Wire `captureError` nos caminhos que engolem erro** (não passam pelo `onRequestError`,
   pois fazem catch e retornam 500):
   - `src/lib/job-queue.ts` → `processDueJobs` (falha de job, ex.: `nfe_emit`)
   - `src/app/api/asaas/webhook/route.ts` e `src/app/api/mercadopago/webhook/route.ts` (catch)
   - opcional: crons (`process-jobs`, `monthly-billing`, `billing-reminders`)
   - Padrão: `await captureError(err, { scope: 'job:nfe_emit', extra: {...} })`
2. **Variáveis de ambiente** (documentar em `docs/DOCUMENTACAO.md` §16):
   - `SENTRY_DSN` (server), `NEXT_PUBLIC_SENTRY_DSN` (client)
   - opcionais: `SENTRY_TRACES_SAMPLE_RATE`, `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE`
3. **Alertas** (5xx, fila, Supabase) — configurar no projeto Sentry após criar a conta/DSN.
4. **(Opcional) Source maps** — upload via CI quando houver build pipeline dedicado.
5. **Validação E2E** com DSN de teste: disparar um erro e confirmar captura
   (sem DSN só dá pra validar a degradação, já feita).

## Como ligar (quando tiver conta Sentry)

```
SENTRY_DSN=https://...@oXXXX.ingest.sentry.io/XXXX
NEXT_PUBLIC_SENTRY_DSN=https://...@oXXXX.ingest.sentry.io/XXXX
```
Sem essas variáveis, o sistema roda normalmente sem enviar nada ao Sentry.
