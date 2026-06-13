# Checklist de Go-Live — Qomanda

> Passo a passo para colocar o primeiro cliente (ex.: hamburgueria de pequeno porte)
> em produção. Ordenado: **🔴 bloqueia o go-live** → **🟡 recomendado** → **🟢 quando quiser/escala**.
>
> Legenda: ✅ pronto no código · ⏳ ação operacional sua. Última revisão: 2026-06-12.  
> **Upgrade free → planos pagos (ordem exata):** [`docs/UPGRADE-PLANOS-PAGOS.md`](UPGRADE-PLANOS-PAGOS.md)  
> **Checklist interativo dos 5 pilotos:** [`/pilotos`](https://kicomanda.app/pilotos) (marcações salvas no navegador).

---

## 🔴 1. Infraestrutura base (produção)

- [x] ✅ **Supabase do projeto em `sa-east-1` (São Paulo)** — confirmado (projeto `supabase-qomanda`).
- [x] ➖ **Connection pooler (Supavisor 6543)** — N/A no runtime: o app usa `supabase-js`/PostgREST (HTTPS), sem conexão Postgres direta. Pooler só p/ migração/BI. Ver `docs/INFRA-SUPABASE-REGION-POOLER.md`.
- [ ] ⏳ **Compute do banco** — hoje `t4g.nano` (60 conns); avaliar upgrade e **ativar backups/PITR** antes do go-live.
- [ ] ⏳ **Deploy na Vercel** com o projeto ligado ao repo (`master`). Plano **Pro** recomendado (timeout 60s, crons confiáveis).
- [ ] ⏳ **Domínios** `kicomanda.app` e `kicomanda.com.br` comprados, DNS na Vercel e `NEXT_PUBLIC_APP_URL=https://kicomanda.app`.

## 🔴 2. Variáveis de ambiente (Vercel → Production)

Mínimo para operar (ver `docs/DOCUMENTACAO.md` §16 para a lista completa):

- [ ] ⏳ `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- [ ] ⏳ `CPF_ENCRYPTION_KEY` (64 hex) e `CPF_HASH_SALT` — **não trocar depois** (quebra hashes de CPF)
- [ ] ⏳ `PLATFORM_SECRETS_KEY` (64 hex) — criptografa credenciais de gateway
- [ ] ⏳ `CRON_SECRET` — protege as rotas `/api/cron/*` (a Vercel envia no header dos crons)
- [ ] ⏳ `KICOMANDA_STAFF_EMAILS` — e-mails da equipe que acessa `/internal`
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
- [ ] ⏳ `migrate-realtime-close-requests.sql`  ← **sem isso a divisão da conta (aceite) não atualiza em tempo real**
- [ ] ⏳ `migrate-performance-indexes.sql`
- [ ] ⏳ `migrate-restaurant-logo-storage.sql`  ← **logo do restaurante** (Settings → Enviar logo); sem isso o bucket `restaurant-logos` não existe
- [ ] ⏳ `migrate-menu-images-storage.sql`  ← fotos do cardápio (opcional até publicar itens com imagem)
- [ ] ⏳ `migrate-waitlist-allocations.sql`  ← **Flow A/B fila** — reserva de grupo (grid Mesas + apontar mesas na fila); `feature_id` opcional + `table_waitlist_allocations`
- [ ] ⏳ `migrate-waitlist-notify-contacts.sql`  ← **WhatsApp na fila** — contato secundário + aviso ao chamar mesa (rodar depois de `migrate-waitlist-allocations.sql`)
- [ ] ⏳ `migrate-waitlist-whatsapp-templates.sql`  ← **textos WhatsApp** customizáveis (Settings → Fila de espera) + confirmação de reserva

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

- [ ] **Mercado Pago OAuth** — criar o app no MP, definir `MERCADO_PAGO_CLIENT_ID/SECRET` e cadastrar o redirect `https://kicomanda.app/api/dashboard/gateway/mercadopago/callback` (código pronto).
- [ ] **NF-e real (cliente)** — credenciais Focus NFe por restaurante (hoje em modo simulado).
- [ ] **NF-e de serviço real** — `KICOMANDA_NFE_TOKEN` + `KICOMANDA_CNPJ` (hoje simulado).
- [ ] **Impressão na cozinha / KDS** — hoje a cozinha vê os pedidos em tela; não há impressora térmica.
- [ ] Itens de escala (Fase 1–2 do `ROADMAP.md`): Upstash cache, índices adicionais, workers dedicados, multi-unidades.

---

### Resumo do que já está pronto (código)
Fila assíncrona · webhooks idempotentes · rate limiting · WhatsApp em fila · índices de performance ·
observabilidade (Sentry + painel Saúde) · analytics + export · cobrança interna (boleto/PIX + e-mail) ·
NF-e de serviço (simulado) · Mercado Pago OAuth (falta app) · gestão de equipe com senha · Chamar Garçom · pedido pelo garçom.

**O que falta é majoritariamente configuração operacional — não desenvolvimento.**
