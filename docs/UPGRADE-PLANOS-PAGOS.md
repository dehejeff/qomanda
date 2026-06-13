# Upgrade para planos pagos — KiComanda

> **Tipo:** how-to (receita operacional)  
> **Quando usar:** ao sair do free e fechar o item **Infraestrutura & escala** do roadmap.  
> **Premissa:** o código da Fase 0 já está pronto; este guia cobre **contas, billing e configuração**.

Ordem recomendada: **Supabase → migrações → Vercel → observabilidade → gateways → validação → runbook**.

---

## O que fica no free vs o que exige pago

| Serviço | Free (agora) | Pago (quando escalar) |
|---------|--------------|------------------------|
| **GitHub** | Repo + Actions costuma bastar | Teams/Enterprise só se precisar de SSO, ambientes protegidos, etc. |
| **Supabase** | Projeto em `sa-east-1`, limites de compute/Realtime | **Pro** — compute maior, **backups + PITR**, alertas |
| **Vercel** | Hobby — deploy OK; crons limitados | **Pro** — crons confiáveis, timeout 60s, mais concorrência |
| **Sentry** | Conta free do Sentry (separado) | Projeto + alertas (não depende de Vercel/Supabase) |
| **Upstash** | Opcional | Redis REST p/ rate limit distribuído (Fase 1 ~20+ restaurantes) |

> **Connection pooler (6543):** N/A no runtime do app (PostgREST por HTTPS). Ver `docs/INFRA-SUPABASE-REGION-POOLER.md`.

---

## Antes de começar

- [ ] Escolher **janela fora do horário de pico** do piloto (ou fim de semana).
- [ ] Anotar URLs e keys atuais (Vercel → Settings → Environment Variables).
- [ ] Confirmar que o projeto Supabase está em **`South America (São Paulo) / sa-east-1`** (Dashboard → Project Settings → General).
- [ ] Ter acesso admin: Supabase, Vercel, Asaas, e-mail Resend, `/internal`.

---

## Passo 1 — Supabase Pro

**Por que primeiro:** migrações e backups no banco antes de redeploy pesado na Vercel.

1. [ ] Supabase Dashboard → **Billing** → upgrade para **Pro** (mesmo projeto `supabase-qomanda`, região `sa-east-1`).
2. [ ] **Database → Backups** → ativar **Point-in-Time Recovery (PITR)** e conferir retenção.
3. [ ] **Database → Settings** → avaliar upgrade de **compute** se CPU/RAM estiverem altos (piloto costuma ficar no tier inicial Pro).
4. [ ] **Database → Extensions / Realtime** → confirmar publicação `supabase_realtime` nas tabelas de pedido, pagamento, sessão, notificações e fila (ver `migrate-realtime-*.sql`).

### Alertas Supabase (recomendado no Pro)

5. [ ] Configurar alertas de **CPU**, **conexões** e **disco** (Dashboard → Reports / Alerts, conforme UI atual).

---

## Passo 2 — Migrações SQL (produção)

Rodar no **SQL Editor** do Supabase (ou `psql` na porta 5432 para DDL longo).  
Ordem completa: `ROADMAP.md` § Migrações. Se o projeto já existe, pule o que já foi aplicado.

### Checklist mínimo (pendências recentes)

- [ ] `migrate-call-waiter.sql`
- [ ] `migrate-realtime-notifications.sql`
- [ ] `migrate-webhook-events.sql`
- [ ] `migrate-service-nfe.sql`
- [ ] `migrate-mercadopago-oauth.sql`
- [ ] `migrate-async-jobs.sql` ← **fila NF-e/WhatsApp**
- [ ] `migrate-billing-reminders.sql`
- [ ] `migrate-realtime-close-requests.sql`
- [ ] `migrate-performance-indexes.sql`
- [ ] `migrate-restaurant-logo-storage.sql`
- [ ] `migrate-menu-images-storage.sql` (se usar foto no cardápio)
- [ ] `migrate-waitlist-allocations.sql`
- [ ] `migrate-waitlist-notify-contacts.sql`
- [ ] `migrate-waitlist-whatsapp-templates.sql`

### Validar após migrações

- [ ] Tabela `async_jobs` existe e aceita insert.
- [ ] Tabela `webhook_events` existe.
- [ ] Bucket `restaurant-logos` (e `menu-images`, se aplicável) visível em Storage.

---

## Passo 3 — Vercel Pro

1. [ ] Vercel → **Settings → Billing** → upgrade do time/projeto para **Pro**.
2. [ ] **Domains** → apontar `kicomanda.app` (e `kicomanda.com.br` se usar) com DNS correto.
3. [ ] Definir **`NEXT_PUBLIC_APP_URL=https://kicomanda.app`** (Production).

### Variáveis de ambiente (Production)

Conferir lista completa em `docs/DOCUMENTACAO.md` §16. Mínimo crítico:

- [ ] `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `CPF_ENCRYPTION_KEY`, `CPF_HASH_SALT` — **não alterar depois** do primeiro cliente real
- [ ] `PLATFORM_SECRETS_KEY`
- [ ] `CRON_SECRET` — Vercel envia no header `Authorization: Bearer …` nos crons
- [ ] `KICOMANDA_STAFF_EMAILS`
- [ ] `NEXT_PUBLIC_DEV_BYPASS=false`
- [ ] `RESEND_API_KEY`
- [ ] `ASAAS_API_KEY`, `ASAAS_ENVIRONMENT=production`, `ASAAS_WEBHOOK_TOKEN`

4. [ ] **Redeploy** Production após salvar env vars.

### Crons (`vercel.json`)

5. [ ] Vercel → projeto → **Cron Jobs** → confirmar que todos aparecem **Enabled**:

| Rota | Função |
|------|--------|
| `/api/cron/process-jobs` | Consome fila NF-e + WhatsApp |
| `/api/cron/monthly-billing` | Mensalidade (dia 5) |
| `/api/cron/billing-reminders` | Lembrete de atraso |
| `/api/cron/financial-retention` | Retenção financeira |
| `/api/cron/nfe-retention-reminders` | Lembrete retenção NF-e |

6. [ ] **`process-jobs` — frequência:** a fila precisa rodar **várias vezes por hora** (ideal: a cada 1 min).  
   Revise o `schedule` em `vercel.json` antes do go-live pago — hoje pode estar em intervalo diário; no **Pro**, ajuste para alta frequência (ex.: `*/5 * * * *` ou conforme limite do plano).  
   Teste manual: `POST /api/cron/process-jobs` com header `Authorization: Bearer <CRON_SECRET>`.

> Crons exigem **Vercel Pro**; no Hobby eles são limitados ou indisponíveis — motivo principal do upgrade.

---

## Passo 4 — Sentry (observabilidade)

Código pronto; falta conta. Detalhes: `docs/OBSERVABILITY-WIP.md`.

1. [ ] Criar projeto no [Sentry](https://sentry.io) (Next.js).
2. [ ] Vercel → env vars:
   - `SENTRY_DSN`
   - `NEXT_PUBLIC_SENTRY_DSN`
3. [ ] Redeploy.
4. [ ] Sentry → **Alerts**: erro 5xx, falhas com scope `job:*`, `webhook:asaas`, `webhook:mercado_pago`.
5. [ ] Disparar um erro de teste (rota inválida ou job forçado) e confirmar recebimento.

**Complemento:** `/internal/health` continua sendo o painel operacional do dia a dia (não substitui o Sentry).

---

## Passo 5 — Gateways e e-mail (produção)

1. [ ] **Asaas** → Webhooks → URL: `https://kicomanda.app/api/asaas/webhook`  
   Token = valor de `ASAAS_WEBHOOK_TOKEN`. Eventos: pagamento confirmado/recebido/atrasado/estornado.
2. [ ] Testar um PIX de mensalidade ou pagamento sandbox → conferir linha em `webhook_events` e status 🟢 em `/internal/health`.
3. [ ] **Resend** — domínio verificado (se ainda não) para e-mails de cobrança e lembretes.

---

## Passo 6 — Upstash Redis (Fase 1, opcional no dia do upgrade)

Só necessário com **várias instâncias Vercel** ou ~20+ restaurantes no pico.

1. [ ] Criar database REST no [Upstash](https://upstash.com) (região próxima: `sa-east-1` ou US-East se não houver).
2. [ ] Vercel → `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.
3. [ ] Redeploy — rate limit passa a ser **distribuído** (`src/lib/rate-limit.ts`).

---

## Passo 7 — Validação

- [ ] `/internal/health` → status **🟢** (fila, webhooks, NF-e).
- [ ] Smokes em `scripts/smoke/` (garçom, pedido, fila, async-jobs, saúde).
- [ ] Fluxo manual: check-in → pedido → cozinha → pagamento → fechar conta.
- [ ] **(Recomendado)** Carga em staging/prod:  
  `LOAD_BASE=https://kicomanda.app LOAD_VUS=50 node scripts/load/load-test.mjs`  
  (ver `scripts/load/README.md` — subir VUs gradualmente).

---

## Passo 8 — Runbook (fechar Infraestrutura & escala)

Escrever (Notion, wiki interna ou `docs/RUNBOOK-DEGRADADO.md`) um procedimento curto:

| Cenário | Comportamento esperado | Ação |
|---------|------------------------|------|
| Focus NFe fora | Pagamento **paid** no app; NF-e fica na fila `async_jobs` | Monitorar `/internal/health`; reprocessar com `POST /api/cron/process-jobs` |
| WhatsApp/Meta fora | NF-e emitida; `whatsapp_send` na fila com retry | Idem; cliente ainda vê nota no app |
| Webhook Asaas duplicado | Idempotência em `webhook_events` | Nenhuma — dedupe automático |
| Fila parada | Jobs `pending` envelhecendo | Verificar cron + `CRON_SECRET`; forçar worker manual |

Quando os passos 1–8 estiverem marcados, o item **Infraestrutura & escala** (Fase 0) pode ser considerado **concluído** no roadmap; Fase 1 (Upstash, carga, alertas DB) entra com ~20–100 restaurantes.

---

## GitHub (opcional)

- [ ] Manter **GitHub Free** enquanto Actions e branch protection forem suficientes.
- [ ] Upgrade **GitHub Team** só se precisar de revisores obrigatórios avançados, ambientes enterprise ou billing centralizado — **não bloqueia** o go-live KiComanda.

---

## Referências cruzadas

- Go-live geral (piloto): `docs/GO-LIVE-CHECKLIST.md`
- Região + pooler + Realtime: `docs/INFRA-SUPABASE-REGION-POOLER.md`
- Sentry: `docs/OBSERVABILITY-WIP.md`
- Roadmap infra: `ROADMAP.md` § Infraestrutura & escala

*Última revisão: 2026-06-12.*
