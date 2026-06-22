# Qomanda — Visão Geral e Arquitetura

## O que é o Qomanda

Qomanda (marca de produto; código interno "KiComanda") é um sistema SaaS de gestão de restaurantes focado em:

- **Autoatendimento via QR Code**: cliente escaneia QR da mesa, faz check-in, pede pelo celular, acompanha o status e paga — tudo sem app instalado (PWA).
- **Modos operacionais**: salão com mesas (dine-in), balcão/fast-food (counter), ambos, ou food hall.
- **Pagamento direto ao restaurante**: 100% do valor cai na conta do restaurante. Qomanda cobra mensalidade (dia 5) = taxa do plano + comissão % sobre GMV digital.
- **NF-e automática**: emite nota fiscal eletrônica ao consumidor (via Focus NFe) após pagamento, e nota de serviço ao restaurante ao quitar a mensalidade.

---

## Arquitetura Técnica

| Camada | Tecnologia |
|--------|-----------|
| Frontend + API | Next.js 16 App Router (Vercel) |
| Banco de dados | Supabase (Postgres + RLS + Realtime + Storage) |
| Auth (restaurante/staff) | Supabase Auth (email + senha) |
| Auth (cliente) | Customizada — WhatsApp + PIN 4 dígitos; sem Supabase Auth |
| Pagamentos (consumidor) | Asaas, Mercado Pago, PIX manual, dinheiro |
| Cobrança (restaurante) | Asaas master account (PIX charge dia 5) |
| NF-e | Focus NFe API (NFC-e e NFS-e) |
| WhatsApp | Meta Cloud API (notificações de fila, NF-e, recibo) |
| Jobs assíncronos | Tabela `async_jobs` + cron `/api/cron/process-jobs` |
| Webhooks | Idempotentes via tabela `webhook_events` (dedup por provider + event_id) |
| Rate limiting | In-memory (dev) ou Upstash Redis (prod) |
| Monitoramento | Sentry (wired, requer DSN) |

### Diagrama de fluxo simplificado

```
Cliente (PWA)                   Restaurante (Dashboard)         Qomanda (Internal)
     │                                  │                               │
     │  QR scan → check-in              │  gestão de menu/mesas         │  visão de todos os clientes
     │  pedido → acompanha              │  kanban de pedidos            │  cobrança mensal
     │  checkout → paga                 │  relatórios                   │  saúde do sistema
     │                                  │  configurações                │  suporte
     └──── Supabase (Postgres + Realtime + Storage) ────────────────────┘
               │              │              │
           Asaas/MP        Focus NFe      Meta WhatsApp
```

---

## Três Superfícies da Aplicação

| Superfície | Rotas | Auth | Público-alvo |
|-----------|-------|------|-------------|
| **Cliente (PWA)** | `/(customer)/[slug]/*` e `/hub` | WhatsApp + PIN (localStorage) | Consumidores do restaurante |
| **Dashboard restaurante** | `/(dashboard)/dashboard/*` e `/garcom` e `/cozinha` | Supabase Auth (owner + equipe) | Donos, garçons, cozinha, caixa |
| **Portal interno Qomanda** | `/(internal)/internal/*` | Supabase Auth + `staff_users` | Equipe Qomanda |

---

## Planos e Precificação

| Plano | Mensalidade | Comissão digital | Max mesas |
|-------|------------|-----------------|-----------|
| Starter | R$ 299/mês | 0,70% | 20 |
| Growth | R$ 399/mês | 0,50% | 50 |
| Pro | R$ 599/mês | 0,30% | ilimitado |
| Enterprise | negociável | negociável | ilimitado |

- Trial grátis: 14 dias (provisionado em `/api/auth/provision-trial` no cadastro).
- Comissão incide apenas sobre pagamentos processados digitalmente (Asaas, Mercado Pago). PIX manual e dinheiro: sem comissão.
- Mensalidade gerada no dia 5 de cada mês via cron `monthly-billing`.

---

## Modos Operacionais de Restaurante

| Modo | Descrição |
|------|----------|
| `dine_in` | Salão com mesas. QR Code por mesa. |
| `counter` | Balcão/fast-food. Cliente entra sem mesa, recebe número de pedido. |
| `both` | Salão + balcão. Cliente escolhe ao chegar. |
| `food_hall` | Múltiplos restaurantes num espaço compartilhado (não totalmente implementado). |

---

## Modelo de Dados Principal

### Hierarquia de entidades

```
restaurants
  ├── plans (FK plano)
  ├── restaurant_subscriptions (1:1)
  ├── billing_invoices (1:N)
  ├── tables (1:N)
  │     └── table_feature_map (N:N com table_features)
  ├── table_features (1:N — seções para fila)
  ├── menu_categories (1:N)
  │     └── menu_items (1:N)
  ├── sessions (1:N)
  │     ├── session_participants (1:N)
  │     ├── orders (1:N)
  │     │     └── order_items (1:N)
  │     ├── payments (1:N)
  │     └── close_requests (1:N)
  │           └── close_request_participants (1:N)
  ├── table_waitlist (1:N)
  │     └── table_waitlist_allocations (1:N)
  ├── loyalty_rules (1:N)
  ├── customer_offers (1:N)
  ├── restaurant_members (1:N — equipe)
  ├── restaurant_notifications (1:N)
  ├── support_tickets (1:N)
  │     └── support_ticket_messages (1:N)
  └── nfe_invoices (1:N)

customers
  ├── customer_visits (1:N)
  ├── customer_offers (1:N)
  └── session_participants (1:N)

staff_users (equipe Qomanda)
async_jobs (fila de jobs: nfe_emit, whatsapp_send)
webhook_events (dedup de webhooks)
platform_asaas_config (singleton de credenciais)
service_nfe_invoices (NF-e Qomanda→restaurante)
```

### Tabelas críticas

**`sessions`** — sessão aberta em uma mesa. Trigger `trg_session_table_status` sincroniza `tables.status` automaticamente (free → occupied → free).

**`payments`** — cada pagamento tem `confirmation_code` único (6 chars), `split_type` (food/alcohol/combined), e aciona fila de jobs após confirmação.

**`async_jobs`** — jobs assíncronos com retry/backoff. Handlers: `nfe_emit` e `whatsapp_send`. Processados a cada minuto pelo cron.

**`table_waitlist`** — `feature_id` nullable (null = "Qualquer seção"). Status: `waiting → notified → seated|expired|cancelled`.

---

## Segurança

- **RLS** habilitado em todas as tabelas. Clientes nunca acessam dados de outros restaurantes.
- **CPF**: armazenado apenas como HMAC-SHA256 (para lookup) + AES-256-GCM (para exibição/NF-e). Nunca em claro.
- **Credenciais de gateway**: `asaas_config.api_key_encrypted` (AES-256-GCM via `secret-crypto.ts`).
- **Service role key**: nunca exposta ao browser. Todas as operações privilegiadas passam por Server Actions ou Route Handlers.
- **Check-in**: exclusivamente server-side. O token do QR Code é verificado antes de qualquer upsert de cliente.

---

## Variáveis de Ambiente Críticas

| Variável | Uso |
|----------|-----|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL (pública) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (pública) |
| `SUPABASE_SERVICE_ROLE_KEY` | Ops privilegiadas (server-side only) |
| `CPF_ENCRYPTION_KEY` | AES-256-GCM para CPF |
| `CPF_HASH_SECRET` | HMAC-SHA256 para CPF lookup |
| `SECRET_ENCRYPTION_KEY` | AES-256-GCM para credenciais de gateway |
| `KICOMANDA_STAFF_EMAILS` | Allowlist de emails de staff (sem `staff_users`) |
| `DEV_BYPASS` | Skip auth (dev only) |
| `QOMANDA_NFE_*` | Credenciais Focus NFe da Qomanda para serviço NF-e |

---

## Jobs Assíncronos e Crons

| Cron | Endpoint | Frequência | O que faz |
|------|----------|-----------|----------|
| Process jobs | `/api/cron/process-jobs` | A cada minuto | Consome `async_jobs`: emite NF-e, envia WhatsApp |
| Monthly billing | `/api/cron/monthly-billing` | Dia 5 de cada mês | Gera faturas + cobranças PIX Asaas para todos os restaurantes ativos |
| Billing reminders | `/api/cron/billing-reminders` | Diário | Emails de cobrança para faturas em atraso |
| Financial retention | `/api/cron/financial-retention` | Diário | Ações de retenção financeira |
| NF-e reminders | `/api/cron/nfe-retention-reminders` | Periódico | Lembretes de configuração de NF-e |

---

## Dois tipos de NF-e

| Tipo | Emissor | Destinatário | Gatilho | Implementação |
|------|---------|-------------|---------|--------------|
| **NF-e do cliente** (NFC-e/NFS-e) | Restaurante | Consumidor | Pagamento confirmado via `async_jobs` | `src/lib/nfe/` + Focus NFe API |
| **NF-e de serviço** | Qomanda | Restaurante | Pagamento de fatura mensal | `src/lib/nfe/service-nfe-emitter.ts` + credenciais `QOMANDA_NFE_*` |
