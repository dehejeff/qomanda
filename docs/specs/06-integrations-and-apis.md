# Specs — Integrações, APIs e Jobs

---

## Gateways de Pagamento

### Asaas (gateway principal)

**Arquivos**: `src/lib/asaas*.ts`, `src/app/api/asaas/*`

#### Modelo de integração
- Qomanda tem uma **conta master** Asaas (`platform_asaas_config`).
- Cada restaurante tem um **subclient** criado via API (`POST /customers` na conta master).
- Cada cobrança é criada com `split` apontando para o subclient do restaurante.
- 100% do valor cai no restaurante. Comissão Qomanda cobrada via fatura mensal separada.

#### Fluxos implementados

**PIX automático**
1. `POST /api/asaas/payments` — cria cobrança PIX na Asaas.
2. Asaas retorna `pixQrCode` (base64) + `pixCopiaECola`.
3. Cliente paga. Asaas confirma via webhook.
4. `POST /api/asaas/webhook` → processa evento `PAYMENT_RECEIVED`.

**Cartão de crédito**
1. `POST /api/asaas/payments/credit-card` — tokeniza via Asaas.js no client.
2. Asaas processa e confirma via webhook.

**Consulta de status**
- `GET /api/asaas/payments/[paymentId]` — polling de status de pagamento.
- Cliente faz polling a cada 3s enquanto aguarda confirmação PIX.

**Webhook Asaas** (`/api/asaas/webhook`)
- Idempotência: verifica `webhook_events` antes de processar.
- Eventos tratados: `PAYMENT_RECEIVED`, `PAYMENT_CONFIRMED`, `PAYMENT_OVERDUE`, `PAYMENT_REFUNDED`.
- Após `PAYMENT_RECEIVED`: `payment.status = 'paid'` → enfileira `async_jobs` (nfe + whatsapp).

**Subclient (onboarding do restaurante)**
- Criado assincronamente após `/api/auth/register`.
- `ensureRestaurantBilling()`: idem para restaurantes legados.
- Status sincronizado periodicamente.

---

### Mercado Pago

**Arquivos**: `src/lib/mercadopago.ts`, `src/app/api/mp/*`

- OAuth Connect: restaurante autoriza via `GET /api/mp/connect` (redirect para MP OAuth).
- Callback: `GET /api/mp/callback` → salva `access_token` em `restaurants.mp_access_token_encrypted`.
- Pagamentos: preferências MP Checkout Pro ou Transparent.
- Webhook: `POST /api/mp/webhook` → processa `payment.updated`.

---

### PIX Manual

Sem integração com gateway. Fluxo operacional:
1. Restaurante configura chave PIX em Settings.
2. No checkout: exibe chave PIX + valor sugerido para o cliente transferir.
3. Cliente clica "Já transferi" → `POST /api/payments/manual-pix` → payment `pending`.
4. Garçom/caixa confirma no `/dashboard/caixa` → `POST /api/dashboard/payments/confirm`.

---

### Dinheiro (cash)

1. Cliente seleciona "Dinheiro" + informa troco (opcional).
2. `POST /api/payments/cash` → payment `pending` + `confirmation_code` (6 chars).
3. Caixa confirma com código → payment `paid`.

---

## NF-e (Notas Fiscais)

### NF-e do Consumidor (NFC-e / NFS-e)

**Arquivos**: `src/lib/nfe/`, `src/lib/focus-nfe.ts`

#### Quando emitir
- Após payment com `status = 'paid'`, se restaurante tem NF-e habilitada.
- Enfileirada como `async_jobs` com `type = 'nfe_emit'`.

#### Handler (`process-nfe-job.ts`)
1. Busca dados do payment + session + itens.
2. Monta payload NFC-e (consumidor físico) ou NFS-e (serviço).
3. POST para Focus NFe API: `POST /v2/nfce` ou `POST /v2/nfse`.
4. Recebe número da nota + link PDF/XML.
5. Salva em `nfe_invoices`: número, chave, link.
6. Enfileira `async_jobs` com `type = 'whatsapp_send'` para enviar link da nota ao cliente.

#### Retry
- Em caso de erro, `async_jobs.retry_count++`.
- Backoff: 1 min → 5 min → 15 min → desistir após 3 tentativas.

#### Split food/alcohol
- Se restaurante habilitou split e payment tem `split_type = 'food'` ou `'alcohol'`, emite duas notas separadas.

---

### NF-e de Serviço (Qomanda → Restaurante)

**Arquivos**: `src/lib/nfe/service-nfe-emitter.ts`

#### Quando emitir
- Após restaurante pagar a fatura mensal.
- Aciona `emitServiceNfe(invoiceId)`.
- Usa credenciais `QOMANDA_NFE_*` (não as do restaurante).
- Salva em `service_nfe_invoices`.
- Staff pode ver status no portal interno.

---

## WhatsApp (Meta Cloud API)

**Arquivos**: `src/lib/whatsapp.ts`, `src/app/api/whatsapp/*`

### Configuração por restaurante
- Restaurante configura `phone_number_id`, `waba_id`, `access_token` em Settings → WhatsApp.
- Credenciais armazenadas criptografadas.
- Qomanda não tem uma conta central de WhatsApp — cada restaurante tem a própria.

### Mensagens enviadas

| Evento | Conteúdo |
|--------|----------|
| Fila — chamada | "Sua mesa está pronta! Você tem X minutos para chegar." |
| Fila — expirou | "Infelizmente seu lugar na fila foi cancelado por tempo de espera." |
| Pagamento confirmado (recibo) | "Obrigado pela visita! Seu recibo: [link]" |
| NF-e emitida | "Sua nota fiscal está disponível: [link PDF]" |
| Fidelidade — prêmio | "Você atingiu X visitas e ganhou [benefício]!" |

### Handler (`process-whatsapp-job.ts`)
1. Busca dados do `async_jobs`: tipo de mensagem + destinatário.
2. Chama `sendWhatsAppMessage()` com template e variáveis.
3. Meta API: `POST /{phone_number_id}/messages` com `Authorization: Bearer {access_token}`.
4. Registra resultado (sucesso/erro) no job.

### Webhook WhatsApp
- `POST /api/whatsapp/webhook`: recebe status de entrega das mensagens.
- `GET /api/whatsapp/webhook`: verificação de challenge (Meta exige).
- Atualiza delivery status em `whatsapp_delivery_log`.

---

## Sistema de Jobs Assíncronos

**Arquivos**: `src/lib/async-jobs.ts`, `src/app/api/cron/process-jobs/route.ts`

### Tabela `async_jobs`
```sql
id            uuid
restaurant_id uuid
type          text  -- 'nfe_emit' | 'whatsapp_send' | 'loyalty_check'
payload       jsonb -- dados do job
status        text  -- 'pending' | 'processing' | 'done' | 'failed'
retry_count   int
max_retries   int   -- default 3
scheduled_at  timestamptz
processed_at  timestamptz
error         text
```

### Cron: `process-jobs` (a cada minuto)
1. Busca jobs `status = 'pending'` com `scheduled_at <= now()`.
2. Marca como `processing` (UPDATE com RETURNING para evitar concorrência).
3. Executa handler por `type`.
4. Marca como `done` ou incrementa `retry_count` + agenda próximo run.
5. Jobs com `retry_count >= max_retries`: marcados como `failed`.

### Handlers por tipo

| Tipo | Handler | O que faz |
|------|---------|-----------|
| `nfe_emit` | `processNfeJob()` | Emite NF-e via Focus NFe |
| `whatsapp_send` | `processWhatsAppJob()` | Envia mensagem WhatsApp |
| `loyalty_check` | `processLoyaltyJob()` | Verifica e concede prêmios de fidelidade |

---

## Crons

**Todos os crons**: autenticados via `CRON_SECRET` header.

| Cron | Rota | Frequência | O que faz |
|------|------|-----------|----------|
| Process jobs | `/api/cron/process-jobs` | A cada minuto | Processa `async_jobs` pendentes |
| Monthly billing | `/api/cron/monthly-billing` | Dia 5 de cada mês, 09:00 BRT | Gera faturas mensais + cobranças Asaas |
| Billing reminders | `/api/cron/billing-reminders` | Diário, 10:00 BRT | Emails para faturas vencidas |
| Financial retention | `/api/cron/financial-retention` | Diário, 11:00 BRT | Ações de retenção para inadimplentes |
| NFe reminders | `/api/cron/nfe-retention-reminders` | Semanal | Lembretes de configuração de NF-e |
| Waitlist cleanup | `/api/cron/waitlist-cleanup` | A cada hora | Expira entradas `notified` sem ação após timeout |
| Session cleanup | `/api/cron/session-cleanup` | Diário, 04:00 BRT | Fecha sessões abertas sem atividade há 24h |

---

## Webhooks (Recepção)

**Tabela `webhook_events`** — deduplicação de webhooks:
```sql
id          uuid
provider    text  -- 'asaas' | 'mercadopago' | 'whatsapp'
event_id    text  -- ID único do evento no provider
payload     jsonb
processed   boolean
created_at  timestamptz
```

Fluxo de processamento:
1. Webhook chega → verifica `webhook_events` (provider + event_id).
2. Se já existe: retorna `200` imediatamente (idempotente).
3. Se novo: insere + processa → atualiza `processed = true`.

**Segurança dos webhooks**:
- Asaas: verifica IP allowlist.
- Meta WhatsApp: verifica assinatura HMAC-SHA256 no header `X-Hub-Signature-256`.

---

## API Routes — Mapa Geral

### Cliente (`/api/customer/*`)
| Rota | Método | O que faz |
|------|--------|-----------|
| `/api/checkin/verify` | GET | Verifica token do QR |
| `/api/checkin` | POST | Cria sessão + check-in |
| `/api/orders` | POST | Cria pedido |
| `/api/customer/waitlist` | GET/POST | Status e entrada na fila |
| `/api/customer/call-waiter` | POST | Chama garçom (throttle 90s) |
| `/api/customer/checkout` | POST | Inicia checkout |
| `/api/payments/cash` | POST | Cria pagamento dinheiro |
| `/api/payments/manual-pix` | POST | Cria pagamento PIX manual |
| `/api/customer/hub/access` | POST | Auth do Hub (senha 6 dígitos) |
| `/api/customer/profile` | GET/PATCH | Perfil do cliente |
| `/api/customer/login` | POST | Login por WhatsApp |
| `/api/customer/login/verify-pin` | POST | Verifica PIN |
| `/api/customer/couvert` | POST | Habilitar/desabilitar couvert |
| `/api/customer/leave-table` | POST | Sair da mesa |

### Dashboard (`/api/dashboard/*`)
| Rota | Método | O que faz |
|------|--------|-----------|
| `/api/dashboard/orders` | GET/PATCH | Listar e atualizar pedidos |
| `/api/dashboard/orders/cancel` | POST | Cancelar pedido |
| `/api/dashboard/kitchen/order-status` | PATCH | Avançar status (cozinha/garçom) |
| `/api/dashboard/waitlist` | GET/POST | Gestão de fila |
| `/api/dashboard/menu` | GET/POST/PATCH/DELETE | CRUD cardápio |
| `/api/dashboard/menu-image` | POST | Upload de imagem |
| `/api/dashboard/tables` | GET/POST/PATCH | CRUD mesas |
| `/api/dashboard/payments/confirm` | POST | Confirmar cash/PIX manual |
| `/api/dashboard/profile` | PATCH | Editar perfil do restaurante |
| `/api/dashboard/members` | GET/POST/DELETE | Gestão de equipe |
| `/api/dashboard/reports` | GET | Dados de relatório |
| `/api/dashboard/reports/export` | GET | Exportar CSV/HTML |
| `/api/dashboard/customers` | GET | Lista de clientes |
| `/api/dashboard/offers/[id]/redeem` | PATCH | Marcar benefício como entregue |
| `/api/dashboard/support/tickets` | GET/POST | Tickets de suporte |
| `/api/dashboard/support/tickets/[id]` | GET/PATCH | Detalhe de ticket |
| `/api/dashboard/gateway` | GET/PATCH | Configurações de gateway |
| `/api/dashboard/billing` | GET | Faturamento do restaurante |
| `/api/dashboard/couvert` | POST | Config de couvert |

### Auth (`/api/auth/*`)
| Rota | Método | O que faz |
|------|--------|-----------|
| `/api/auth/register` | POST | Cadastro de restaurante |
| `/api/auth/provision-trial` | POST | Provisiona trial 14 dias |

### Webhooks (`/api/asaas/webhook`, `/api/mp/webhook`, `/api/whatsapp/webhook`)

### Internal (`/api/internal/*`)
Ver [04-internal-portal.md](./04-internal-portal.md) — seção "API Routes Internas".

---

## Criptografia

**Arquivo**: `src/lib/crypto.ts` + `src/lib/secret-crypto.ts`

| Dado | Algoritmo | Chave env |
|------|-----------|-----------|
| CPF (armazenamento) | AES-256-GCM | `CPF_ENCRYPTION_KEY` |
| CPF (lookup) | HMAC-SHA256 | `CPF_HASH_SECRET` |
| Credenciais de gateway | AES-256-GCM | `SECRET_ENCRYPTION_KEY` |

Nunca descriptografar no cliente. Todas as operações de cripto são server-side.

---

## Rate Limiting

**Arquivo**: `src/lib/rate-limit.ts`

- Dev: in-memory (Map + TTL simples).
- Prod: Upstash Redis via `@upstash/ratelimit`.

| Endpoint | Limite |
|----------|--------|
| `/api/checkin` | 10 req/min por IP |
| `/api/customer/login` | 5 req/min por WhatsApp |
| `/api/customer/call-waiter` | 1 req/90s por sessão |
| `/api/orders` | 20 req/min por sessão |
