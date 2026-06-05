# Checklist de Go-Live — Qomanda

> Passo a passo para colocar o primeiro cliente (ex.: hamburgueria de pequeno porte)
> em produção. Ordenado: **🔴 bloqueia o go-live** → **🟡 recomendado** → **🟢 quando quiser/escala**.
>
> Legenda: ✅ pronto no código · ⏳ ação operacional sua. Última revisão: 2026-06-05.

---

## 🔴 1. Infraestrutura base (produção)

- [ ] ⏳ **Supabase do projeto em `sa-east-1` (São Paulo)** — latência BR (ver `ROADMAP.md` § Decisão de arquitetura).
- [ ] ⏳ **Connection pooler (Supavisor, porta 6543)** na connection string usada pelo servidor.
- [ ] ⏳ **Deploy na Vercel** com o projeto ligado ao repo (`master`). Plano **Pro** recomendado (timeout 60s, crons confiáveis).
- [ ] ⏳ **Domínio** apontado (ex.: `qomanda.app`) e `NEXT_PUBLIC_APP_URL` apontando para ele.

## 🔴 2. Variáveis de ambiente (Vercel → Production)

Mínimo para operar (ver `docs/DOCUMENTACAO.md` §16 para a lista completa):

- [ ] ⏳ `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- [ ] ⏳ `CPF_ENCRYPTION_KEY` (64 hex) e `CPF_HASH_SALT` — **não trocar depois** (quebra hashes de CPF)
- [ ] ⏳ `PLATFORM_SECRETS_KEY` (64 hex) — criptografa credenciais de gateway
- [ ] ⏳ `CRON_SECRET` — protege as rotas `/api/cron/*` (a Vercel envia no header dos crons)
- [ ] ⏳ `QOMANDA_STAFF_EMAILS` — e-mails da equipe que acessa `/internal`
- [ ] ⏳ `NEXT_PUBLIC_DEV_BYPASS=false` em produção (NUNCA `true`)
- [ ] ⏳ `RESEND_API_KEY` — envio real de e-mail (cobrança, lembretes, NF-e retenção). Sem ela, e-mail vira mock.
- [ ] ⏳ `ASAAS_API_KEY` + `ASAAS_ENVIRONMENT=production` + `ASAAS_WEBHOOK_TOKEN` — cobrança da mensalidade (conta master Qomanda)

## 🔴 3. Migrações Supabase (rodar em produção)

Ordem completa em `ROADMAP.md` § Migrações. As mais recentes desta fase **precisam estar aplicadas**:

- [ ] ⏳ `migrate-call-waiter.sql`
- [ ] ⏳ `migrate-realtime-notifications.sql`  ← **sem isso o sino/Chamar Garçom não funciona em tempo real**
- [ ] ⏳ `migrate-webhook-events.sql`
- [ ] ⏳ `migrate-service-nfe.sql`
- [ ] ⏳ `migrate-mercadopago-oauth.sql`
- [ ] ⏳ `migrate-async-jobs.sql`  ← **sem isso a fila (NF-e/WhatsApp) não processa**
- [ ] ⏳ `migrate-billing-reminders.sql`
- [ ] ⏳ `migrate-performance-indexes.sql`

## 🔴 4. Crons (Vercel)

`vercel.json` já define os agendamentos — confirme que estão ativos no painel da Vercel:

- [ ] ✅ `/api/cron/process-jobs` (a cada minuto) — fila NF-e/WhatsApp
- [ ] ✅ `/api/cron/monthly-billing` (dia 5) — fatura da mensalidade
- [ ] ✅ `/api/cron/billing-reminders` (diário) — lembrete de atraso
- [ ] ✅ `/api/cron/financial-retention`, `/api/cron/nfe-retention-reminders`

## 🔴 5. Cadastro do restaurante piloto

- [ ] Criar o restaurante (`/internal/clients/new` ou auto-cadastro `/cadastro`) com o **modelo operacional** certo (balcão / salão / ambos).
- [ ] Montar o **cardápio** (categorias + itens + preços).
- [ ] Se salão: criar **mesas** e imprimir os **QR codes**.
- [ ] **Pagamento**: definir forma de recebimento em Settings → Pagamentos.
  - PIX manual (chave do dono) + dinheiro → **funciona na hora, sem gateway**.
  - Cartão/PIX automático → conectar **Asaas** ou **Mercado Pago** (token manual já funciona).
- [ ] **Equipe**: cadastrar garçom em Settings → Equipe **com senha** (libera o login em `/garcom`).

---

## 🟡 6. Recomendado antes de depender 100%

- [ ] ⏳ **Sentry** — criar projeto e definir `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN` (código pronto; ver `docs/OBSERVABILITY-WIP.md`). Configurar **alertas** (5xx, falha de job, erro de webhook).
- [ ] ⏳ **Alertas no Supabase** — CPU, conexões, uso de disco.
- [ ] ✅ **Painel de Saúde** (`/internal/health`) — checar o sinal 🟢 antes/depois de abrir.
- [ ] ⏳ **Webhook Asaas em produção** — cadastrar a URL `…/api/asaas/webhook` + `ASAAS_WEBHOOK_TOKEN` (idempotência já tratada).
- [ ] ⏳ **Upstash Redis** (opcional) — `UPSTASH_REDIS_REST_URL/TOKEN` para rate limit/throttle **distribuído** (sem isso, é por instância — ok para piloto).

## 🟡 7. Validação final (smoke + carga)

Com o ambiente de staging/produção no ar:

- [ ] Rodar os smokes relevantes em `scripts/smoke/` (garçom, pedido, cobrança, fila, saúde…).
- [ ] **Teste de carga** contra staging: `LOAD_BASE=https://staging… LOAD_VUS=200 node scripts/load/load-test.mjs` (ver `scripts/load/README.md`).
- [ ] Fluxo manual ponta a ponta: check-in → pedido → cozinha → pagamento (PIX manual/dinheiro) → fechar conta.

---

## 🟢 8. Quando quiser / escala

- [ ] **Mercado Pago OAuth** — criar o app no MP, definir `MERCADO_PAGO_CLIENT_ID/SECRET` e cadastrar o redirect `https://qomanda.app/api/dashboard/gateway/mercadopago/callback` (código pronto).
- [ ] **NF-e real (cliente)** — credenciais Focus NFe por restaurante (hoje em modo simulado).
- [ ] **NF-e de serviço real** — `QOMANDA_NFE_TOKEN` + `QOMANDA_CNPJ` (hoje simulado).
- [ ] **Impressão na cozinha / KDS** — hoje a cozinha vê os pedidos em tela; não há impressora térmica.
- [ ] Itens de escala (Fase 1–2 do `ROADMAP.md`): Upstash cache, índices adicionais, workers dedicados, multi-unidades.

---

### Resumo do que já está pronto (código)
Fila assíncrona · webhooks idempotentes · rate limiting · WhatsApp em fila · índices de performance ·
observabilidade (Sentry + painel Saúde) · analytics + export · cobrança interna (boleto/PIX + e-mail) ·
NF-e de serviço (simulado) · Mercado Pago OAuth (falta app) · gestão de equipe com senha · Chamar Garçom · pedido pelo garçom.

**O que falta é majoritariamente configuração operacional — não desenvolvimento.**
