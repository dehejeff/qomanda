# Observabilidade (Sentry)

> Status: **base + wiring concluídos** (2026-06-04). Integração degradável no ar,
> `captureError` ligado nos caminhos de background, env vars documentadas.
> Falta apenas: **criar conta/DSN no Sentry + configurar alertas** (não é código).

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

## Wiring concluído (`captureError` nos caminhos que engolem erro)

Esses pontos fazem catch e retornam sem relançar, então **não** passam pelo `onRequestError` —
por isso recebem `captureError` manual:
- [x] `src/lib/job-queue.ts` → `processDueJobs` (job esgotou tentativas) — `scope: job:<type>`
- [x] `src/app/api/asaas/webhook/route.ts` (catch) — `scope: webhook:asaas`
- [x] `src/app/api/mercadopago/webhook/route.ts` (catch) — `scope: webhook:mercado_pago`
- [x] Variáveis de ambiente documentadas em `docs/DOCUMENTACAO.md` §16

Erros **não tratados** em route handlers / server components são capturados automaticamente
pelo `onRequestError` (`src/instrumentation.ts`).

## Painel interno em tempo real (sem depender do Sentry)

`/internal/health` ("Saúde") mostra os sinais operacionais já persistidos no banco, com
**auto-refresh (15s)**:
- **Fila** (`async_jobs`): pendentes, em erro (24h), mais antigo pendente, processados (24h)
- **Webhooks** (`webhook_events`): erros e processados (24h)
- **NF-e** em erro + **faturas em atraso**
- **Status geral** 🟢/🟡/🔴 + feed dos erros recentes (job/webhook/NF-e)

Camadas complementares: o **painel interno** é o raio-x operacional do dia a dia; o **Sentry**
(externo, ao configurar o DSN) traz stack traces e alertas push.
Libs: `src/lib/internal-health.ts` · API `GET /api/internal/health`.

## O que falta (não é código)

1. **Criar conta/projeto no Sentry** e preencher `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN`.
2. **Alertas** (5xx, falha de job/fila, erros de webhook) — configurar no projeto Sentry.
3. **(Opcional) Source maps** — upload via CI quando houver pipeline dedicado.
4. **(Opcional) Mais `captureError`** em crons (`monthly-billing`, `billing-reminders`) se quiser granularidade.

## Como ligar (quando tiver conta Sentry)

```
SENTRY_DSN=https://...@oXXXX.ingest.sentry.io/XXXX
NEXT_PUBLIC_SENTRY_DSN=https://...@oXXXX.ingest.sentry.io/XXXX
```
Sem essas variáveis, o sistema roda normalmente sem enviar nada ao Sentry.
