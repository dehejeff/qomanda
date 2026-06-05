# Qomanda — Documentação Técnica Completa

> Versão 4.0 · Atualizado em 2026-06-02
>
> **Novidades v4.0:** modelos operacionais por tipo (salão/balcão/salão+balcão/food hall)
> com painel adaptado, gateway de pagamento por restaurante (PIX manual / Asaas) +
> comissão mensal, emissão de NF-e (NFC-e/NFS-e) com envio por WhatsApp, e cobrança
> automática da mensalidade. Ver **§19 — Módulos & Funcionalidades (v4.0)**.

---

## Índice

1. [Visão Geral do Produto](#1-visão-geral-do-produto)
2. [Arquitetura do Sistema](#2-arquitetura-do-sistema)
3. [Stack Tecnológico](#3-stack-tecnológico)
4. [Estrutura de Arquivos](#4-estrutura-de-arquivos)
5. [Modelo de Dados](#5-modelo-de-dados)
6. [Fluxos do Cliente (PWA Mobile)](#6-fluxos-do-cliente-pwa-mobile)
7. [Fluxos do Admin (Dashboard)](#7-fluxos-do-admin-dashboard)
8. [Portal Interno Qomanda (Staff)](#8-portal-interno-qomanda-staff)
9. [Sistema de Suporte (Tickets)](#9-sistema-de-suporte-tickets)
10. [Sistema de Pagamentos (Qomanda Pay / Asaas)](#10-sistema-de-pagamentos-qomanda-pay--asaas)
11. [Programa de Fidelidade](#11-programa-de-fidelidade)
12. [Integração WhatsApp e NF-e](#12-integração-whatsapp-e-nf-e)
13. [Regras de Negócio](#13-regras-de-negócio)
14. [Segurança e LGPD](#14-segurança-e-lgpd)
15. [API Routes](#15-api-routes)
16. [Variáveis de Ambiente](#16-variáveis-de-ambiente)
17. [Configuração Inicial (Supabase)](#17-configuração-inicial-supabase)
18. [Roadmap](#18-roadmap)
19. [Módulos & Funcionalidades (v4.0)](#19-módulos--funcionalidades-v40)

---

## 1. Visão Geral do Produto

A **Qomanda** é uma plataforma SaaS de cardápio digital e pagamento integrado para restaurantes e bares. Diferente de concorrentes como Goomer (apenas cardápio) e iFood (marketplace com comissão), a Qomanda é a única plataforma no Brasil que combina:

- Cardápio digital via QR Code
- Pedidos direto do celular do cliente (sem app)
- Pagamento integrado (PIX, débito, crédito)
- Divisão de conta inteligente
- Programa de fidelidade automático
- Nota fiscal por WhatsApp

**Modelo de preço:** mensalidade fixa por tamanho de operação + porcentagem sobre transações processadas pelo Qomanda Pay.

| Plano    | Mesas | Mensalidade | Taxa por transação |
|----------|-------|-------------|-------------------|
| Starter  | ≤ 20  | R$ 199/mês  | 1,99%             |
| Growth   | ≤ 50  | R$ 299/mês  | 1,79%             |
| Pro      | ≤ 100 | R$ 449/mês  | 1,49%             |
| Enterprise | 100+ | Sob consulta | Negociável       |

---

## 2. Arquitetura do Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                        INTERNET                             │
└──────────────────────────┬──────────────────────────────────┘
                           │
                    ┌──────▼──────┐
                    │   Vercel    │  (Next.js 16 — App Router)
                    │  (deploy)   │
                    └──────┬──────┘
                           │
     ┌─────────────────────┼─────────────────────┐
     │                     │                     │
┌────▼─────┐      ┌────────▼────────┐    ┌──────▼──────┐
│  PWA     │      │  Dashboard      │    │  Portal     │
│  Cliente │      │  Restaurante    │    │  Interno    │
│  /[slug] │      │  /dashboard     │    │  /internal  │
└────┬─────┘      └────────┬────────┘    └──────┬──────┘
     │                     │                     │
     └─────────────────────┼─────────────────────┘
                           │
                    ┌──────▼──────┐
                    │  Supabase   │
                    │  ┌────────┐ │
                    │  │Postgres│ │  (Banco de dados)
                    │  ├────────┤ │
                    │  │  Auth  │ │  (Admin + staff + clientes hub)
                    │  ├────────┤ │
                    │  │Realtime│ │  (WebSockets para pedidos)
                    │  ├────────┤ │
                    │  │Storage │ │  (Imagens, anexos suporte)
                    │  └────────┘ │
                    └──────┬──────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
    ┌─────▼─────┐   ┌──────▼──────┐  ┌─────▼──────┐
    │  Asaas /  │   │  WhatsApp   │  │  Focus NFe │
    │  Mercado  │   │  Business   │  │ (cliente + │
    │  Pago     │   │  API (Meta) │  │  serviço)  │
    └───────────┘   └─────────────┘  └────────────┘
```

### Padrão de comunicação

- **Cliente → Supabase:** chamadas diretas via SDK client-side (Row Level Security protege os dados)
- **Admin → Supabase:** chamadas server-side com session auth
- **Realtime:** Supabase Realtime (WebSocket) para pedidos, sessões e notificações
- **Pagamentos:** API route Next.js → Asaas (Qomanda Pay) → Webhook de confirmação
- **Split:** taxa da plataforma retida por transação conforme plano do restaurante
- **WhatsApp:** API route Next.js → Meta WhatsApp Cloud API
- **Portal interno:** APIs `/api/internal/*` com `requireStaff()` (service role)

---

## 3. Stack Tecnológico

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Framework | Next.js (App Router) | 16.2.6 |
| Linguagem | TypeScript | 5.x |
| Estilização | Tailwind CSS | 4.x |
| Banco de dados | Supabase (PostgreSQL) | 2.x SDK |
| Autenticação | Supabase Auth | — |
| Realtime | Supabase Realtime | — |
| Pagamentos | Asaas (Qomanda Pay — marketplace/split) | — |
| Ícones | Material Symbols (Google) | — |
| Fonte | Geist + JetBrains Mono | — |
| Deploy | Vercel | — |
| QR Code | `qrcode` (geração) + `BarcodeDetector` API (leitura) | — |
| Notificações | Sonner (toast) | 2.x |

---

## 4. Estrutura de Arquivos

```
qomanda/
├── docs/
│   └── DOCUMENTACAO.md        ← este arquivo
├── scripts/
│   └── setup-internal-staff.mjs
├── supabase/
│   ├── schema.sql             ← schema base
│   └── migrate-*.sql          ← migrações incrementais
├── src/
│   ├── app/
│   │   ├── (customer)/        ← PWA do cliente (sem auth Supabase)
│   │   │   └── [slug]/        ← check-in, home, menu, orders, checkout, profile
│   │   ├── (dashboard)/       ← painel do restaurante (auth owner)
│   │   │   └── dashboard/     ← overview, orders, menu, tables, settings, support
│   │   ├── (internal)/        ← portal interno Qomanda (auth staff)
│   │   │   └── internal/      ← overview, clients, support, gateway
│   │   ├── api/
│   │   │   ├── asaas/         ← pagamentos + webhook Asaas
│   │   │   ├── checkin/       ← check-in server-side (service role)
│   │   │   ├── customer/      ← perfil, hub, PIN, cartões
│   │   │   ├── dashboard/     ← payout, whatsapp, support, menu-image
│   │   │   └── internal/      ← clients, overview, gateway, support, plans
│   │   ├── hub/               ← área hub do cliente
│   │   ├── scan/              ← scanner QR
│   │   ├── roadmap/           ← roadmap público
│   │   └── page.tsx           ← landing page
│   ├── components/
│   │   ├── customer/
│   │   ├── dashboard/
│   │   ├── internal/          ← formulários e charts do portal staff
│   │   └── support/           ← UI compartilhada de tickets
│   ├── lib/
│   │   ├── supabase/          ← client, server, admin
│   │   ├── asaas.ts           ← cliente Asaas
│   │   ├── internal-clients.ts
│   │   ├── internal-overview.ts
│   │   ├── staff-auth.ts
│   │   ├── support-tickets.ts
│   │   ├── restaurant-nfe.ts
│   │   ├── restaurant-profile.ts
│   │   ├── restaurant-whatsapp.ts
│   │   └── crypto.ts
│   └── types/
│       ├── index.ts
│       └── internal.ts
├── ROADMAP.md
├── README.md
└── AGENTS.md
```

---

## 5. Modelo de Dados

### Diagrama de relacionamentos

```
auth.users
    │ 1
    │
restaurants (1) ─── (N) tables
    │                     │
    │ 1                   │ 1
    │                     │
    ├── (N) menu_categories
    │         │
    │         └── (N) menu_items (contains_alcohol)
    │
    ├── (N) loyalty_rules
    │
    └── (N) sessions ────────────── (1) customers
              │                           │
              ├── (N) session_participants (N)
              │                           │
              ├── (N) orders              │
              │         │                 │
              │         └── (N) order_items
              │                   │
              │                   └── (1) menu_items
              │
              ├── (N) payments ── (1) customers
              │
              ├── (1) customer_visits ── (1) customers
              │
              └── (N) close_requests
                        │
                        └── (N) close_request_participants ── (1) customers
                                          │
                                          └── (1) payments
```

### Tabelas principais

#### `restaurants`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | PK |
| owner_id | uuid | FK → auth.users |
| name | text | Nome do restaurante |
| slug | text | URL amigável (único) — ex: `tasca-do-porto` |
| logo_url | text | URL do logo (Supabase Storage) |
| status | text | `active` \| `inactive` |
| whatsapp_phone_id | text | ID do número WhatsApp Business |
| whatsapp_access_token | text | Token da Meta Cloud API |
| whatsapp_nfe_enabled | boolean | Enviar nota automática |

#### `customers`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | PK |
| first_name | text | — |
| last_name | text | — |
| whatsapp | text | Identificador primário (único, dígitos) |
| document_type | text | `cpf` \| `passport` |
| cpf_hash | text | HMAC-SHA256 do CPF — para busca/unicidade (único, irreversível) |
| cpf_encrypted | text | AES-256-GCM do CPF — para NF-e futura (reversível via service role) |
| passport | text | Passaporte para estrangeiros |

> **⚠️ CPF nunca armazenado em texto puro.** Ver seção [Segurança e LGPD](#12-segurança-e-lgpd).
>
> **Regra de upsert:** na ordem `cpf_hash` → WhatsApp. O hash do CPF garante continuidade do histórico mesmo se o cliente trocar de número.

#### `sessions`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | PK |
| table_id | uuid | FK → tables |
| restaurant_id | uuid | FK → restaurants |
| customer_id | uuid | FK → customers (quem abriu a sessão) |
| status | text | `open` \| `closing` \| `closed` |
| table_history | jsonb | `[{"from":"3","to":"5","at":"ISO"}]` |

> **Regra:** uma mesa só pode ter uma sessão com `status = 'open'` por vez. Novos check-ins entram na sessão existente (via `session_participants`).

#### `orders`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| customer_id | uuid | FK → customers (quem fez o pedido) |
| status | text | `pending` → `confirmed` → `preparing` → `ready` → `delivered` |
| updated_at | timestamptz | Atualizado automaticamente por trigger |

#### `payments`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| customer_id | uuid | Quem efetuou o pagamento |
| amount | numeric | Valor pago (pode ser > cota calculada) |
| split_type | text | `combined` \| `food` \| `alcohol` |
| method | text | `pix` \| `debit` \| `credit` |
| status | text | `pending` → `paid` \| `failed` \| `refunded` |
| confirmation_code | text | Código de 6 caracteres para validação presencial |

#### `close_requests`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| initiator_id | uuid | Quem iniciou o fechamento |
| mode | text | `individual` \| `table` |
| status | text | `pending` \| `completed` \| `cancelled` |

#### `close_request_participants`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| amount_owed | numeric | Cota calculada (definida pelo iniciador) |
| amount_paid | numeric | Pode ser ≥ `amount_owed` |
| payment_id | uuid | FK → payments (preenchido quando pago) |
| status | text | `pending` → `confirmed` → `paid` \| `declined` |

---

## 6. Fluxos do Cliente (PWA Mobile)

### 6.1 Jornada completa

```
                         Landing page (/)
                               │
                        "Cliente?" → /scan
                               │
                    ┌──────────▼──────────┐
                    │  Scanner QR Code    │
                    │  BarcodeDetector    │
                    │  API (nativa)       │
                    └──────────┬──────────┘
                               │ detecta URL: /{slug}?mesa={n}
                    ┌──────────▼──────────┐
                    │  Check-in           │  /{slug}?mesa={n}
                    │  Nome + WhatsApp    │
                    │  CPF (opcional)     │
                    │  Passaporte (opt.)  │
                    └──────────┬──────────┘
                               │ cria/entra sessão
                    ┌──────────▼──────────┐
                    │  Home Hub           │  /{slug}/home
                    │  Status do pedido   │
                    │  Atalhos rápidos    │
                    └──────┬──────┬───────┘
                    ┌──────┘      └──────┐
          ┌─────────▼──────┐  ┌─────────▼──────┐
          │  Cardápio      │  │  Pedidos        │
          │  /{slug}/menu  │  │  /{slug}/orders │
          │                │  │  ─ Minha Conta  │
          │  Categorias    │  │  ─ Mesa Toda    │
          │  + Carrinho    │  └────────┬────────┘
          │  + Fazer pedido│           │
          └────────────────┘  ┌────────▼────────┐
                              │  Checkout       │
                              │  ─ Só eu        │
                              │  ─ Mesa toda    │
                              └────────┬────────┘
                                       │
                              PIX / Débito / Crédito
                                       │
                              WhatsApp → NF-e
```

### 6.2 Check-in — fluxo seguro (server-side)

O check-in é a operação mais sensível do sistema: cria/atualiza dados PII do cliente.
Por isso, **toda a lógica roda em uma API route server-side** (`/api/checkin`) usando
a `SUPABASE_SERVICE_ROLE_KEY`, que nunca é exposta ao browser.

```
Browser (cliente)
        │
        │  POST /api/checkin
        │  { slug, mesa, firstName, lastName, whatsapp, cpf? }
        │
        ▼
API Route — /api/checkin (server-side, service role)
        │
        ├─ 1. Resolve restaurante pelo slug
        │
        ├─ 2. Upsert do cliente:
        │       Tem CPF? → hashCPF() → busca por cpf_hash
        │          ├─ Encontrou → atualiza nome/WhatsApp
        │          └─ Não → upsert por whatsapp (onConflict)
        │              CPF armazenado como:
        │              cpf_hash      = HMAC-SHA256(cpf, salt)
        │              cpf_encrypted = AES-256-GCM(cpf, key)
        │
        ├─ 3. Mesa: busca por restaurant_id + number
        │
        ├─ 4. Sessão: entra na existente (se open) ou cria nova
        │
        ├─ 5. Insere em session_participants (upsert)
        │
        └─ 6. Insere em customer_visits (upsert, fidelidade)
                │
                ▼
        Response: { sessionId, customerId, isJoining }
                │
                ▼
Browser: salva em localStorage:
  - qomanda_session_id
  - qomanda_customer_id
  - qomanda_customer_name
```

> O browser **nunca chama a tabela `customers` diretamente**. A `ANON_KEY` não tem
> permissão de SELECT em `customers` — isso é aplicado via RLS.

### 6.3 Navegação inferior (5 tabs)

| Tab | Rota | Ativo quando |
|-----|------|-------------|
| Início | `/{slug}/home` | pathname contém `/home` |
| Cardápio | `/{slug}/menu` | pathname contém `/menu` |
| Pedidos | `/{slug}/orders` | pathname contém `/orders` |
| Pagamento | `/{slug}/checkout` | pathname contém `/checkout` |
| Perfil | `/{slug}/profile` | pathname contém `/profile` |

---

## 7. Fluxos do Admin (Dashboard)

### 7.1 Autenticação

Rota `/login` → `supabase.auth.signInWithPassword()` → redireciona para `/dashboard`.

O layout `/dashboard/layout.tsx` é server-side: verifica `auth.getUser()` e redireciona para `/login` se não autenticado. Em modo de desenvolvimento (`NEXT_PUBLIC_DEV_BYPASS=true`), o middleware é ignorado.

### 7.2 Páginas do painel

| Página | Rota | Função |
|--------|------|--------|
| Overview | `/dashboard` | KPIs (mesas ocupadas, pedidos abertos, receita do dia), mapa de mesas, pedidos recentes |
| Pedidos | `/dashboard/orders` | Kanban: `pending → confirmed → preparing → ready → delivered` |
| Cardápio | `/dashboard/menu` | CRUD de categorias e itens, toggle de disponibilidade, toggle de álcool |
| Mesas | `/dashboard/tables` | Grid de mesas, status visual, geração de QR Code, gestão (troca de mesa) |
| Settings | `/dashboard/settings` | Pagamentos, Fidelidade, Integrações (WhatsApp), Segurança |
| Suporte | `/dashboard/support` | Tickets de suporte ao restaurante (mensagens + anexos) |

### 7.3 Atualização de status de pedido

```
Dashboard → botão de status
    │
    ▼
supabase.from('orders').update({ status: novoStatus })
    │
    ▼
Supabase Realtime → cliente recebe update em tempo real
    │
    ▼
Barra de progresso do pedido atualiza na tela do cliente
```

### 7.4 Fechamento de mesa pelo garçom

O garçom pode marcar a sessão como `closing`:

```
Dashboard → "Fechar mesa"
    │
    ▼
sessions.update({ status: 'closing' })
    │
    ▼
Realtime → cliente recebe notificação
    │
    ▼
Banner vermelho: "O garçom está encerrando sua mesa"
    │
    ▼
Cliente clica em "Pagar agora" → /checkout
```

---

## 8. Portal Interno Qomanda (Staff)

> Rotas em `/internal/*` — acesso restrito à equipe Qomanda.

### 8.1 Autenticação

1. Login em `/internal/login` via Supabase Auth
2. `requireStaff()` valida:
   - registro ativo em `staff_users`, **ou**
   - e-mail na allowlist `QOMANDA_STAFF_EMAILS`
3. Em dev com `NEXT_PUBLIC_DEV_BYPASS=true`, acesso liberado sem auth

Provisionamento de contas:

```bash
node scripts/setup-internal-staff.mjs
```

### 8.2 Páginas

| Página | Rota | Função |
|--------|------|--------|
| Overview | `/internal` | KPIs comerciais, gráficos, fila operacional |
| Clientes | `/internal/clients` | Listagem de restaurantes |
| Novo cliente | `/internal/clients/new` | Cadastro completo (abas) |
| Cliente | `/internal/clients/[id]` | Edição: estabelecimento, NF-e, plano, NF-e serviço |
| Cobrança | `/internal/billing` | Status de pagamento das mensalidades + emitir boleto/PIX |
| Suporte | `/internal/support` | Fila de tickets |
| Gateway Pay | `/internal/gateway` | Credenciais Asaas da plataforma |
| Saúde | `/internal/health` | Monitor em tempo real: fila, webhooks, NF-e em erro, atraso + status geral |

### 8.3 Métricas do Overview

| Card | Significado |
|------|-------------|
| **MRR planos** | Mensalidade contratada (inclui trial) |
| **Taxa tx 30d** | Comissão Qomanda sobre pagamentos digitais |
| **Receita Qomanda 30d** | Taxas tx no período (mensalidade entra após trial ativo) |
| **Volume Pay 30d** | GMV — valor pago nas mesas (dinheiro do restaurante, não receita Qomanda) |

Lib de agregação: `src/lib/internal-overview.ts`

### 8.4 Billing por restaurante

Tabelas:
- `plans` — catálogo comercial (Starter R$ 199 / 1,99%, etc.)
- `restaurant_subscriptions` — assinatura (trialing, active, …)
- `restaurants.plan_id`, `platform_fee_percent`, `platform_fee_fixed` — taxas efetivas para split
- `billing_invoices` — faturas de mensalidade (status, due_date, paid_at, asaas_payment_id, invoice_url)

`ensureRestaurantBilling()` em `internal-clients.ts` repara clientes criados sem plano/assinatura.

**Painel de Cobrança** (`/internal/billing`, lib `internal-billing.ts`): visão consolidada de
todos os clientes com assinatura, com status derivado por data no fuso BR — **paga**,
**a vencer** (≤5 dias), **em atraso** (com nº de dias) ou **sem fatura** — e KPIs (em
aberto, em atraso, a vencer, pagas no mês). Ações via `POST /api/internal/billing`:
- `generate` — cria a fatura do mês + cobrança Asaas (boleto ou PIX) — `generateMonthlyInvoice`
- `charge` — emite a cobrança de uma fatura existente sem cobrança — `chargeInvoice`
- `mark_paid` — concilia manualmente + dispara a NF-e de serviço

A cobrança automática mensal (cron dia 5) continua gerando faturas; o painel permite
emissão/acompanhamento sob demanda.

**E-mail de cobrança** (`internal-billing-email.ts`): ao gerar/emitir a cobrança, envia
e-mail ao responsável (conta ou contato comercial) com valor, vencimento e link. O cron
diário `/api/cron/billing-reminders` (12h) reenvia para faturas **em atraso**, no máximo
1x/dia por fatura (`last_reminder_at`), e marca a fatura como `overdue`.

**Exportação CSV**: `GET /api/internal/billing/export` (staff) baixa a planilha (com BOM
p/ Excel) de todos os clientes — status, dias em atraso, valor, vencimento, método.

### 8.5 NF-e — duas notas distintas

| Tipo | Emissor → Destinatário | Onde configurar |
|------|------------------------|-----------------|
| **NF-e cliente** | Restaurante → consumidor | Aba NF-e cliente (interno) + Focus NFe |
| **NF-e serviço** | Qomanda → restaurante | Aba NF-e serviço (emissão ao pagar a fatura) |

WhatsApp para envio de NF-e ao consumidor: restaurante configura em **Settings → Integrações**; staff vê apenas status.

A **NF-e de serviço** é emitida automaticamente quando a fatura de mensalidade é paga (ver §10.8). A aba mostra o status real por fatura, botão de emissão manual e link do PDF.

---

## 9. Sistema de Suporte (Tickets)

### 9.1 Fluxo

```
Restaurante → /dashboard/support → cria ticket + anexos
                        │
                        ▼
              support_tickets (Supabase)
                        │
                        ▼
Staff → /internal/support → responde, altera status/prioridade
```

### 9.2 Tabelas

- `support_tickets` — assunto, categoria, status, prioridade, assignee
- `support_ticket_messages` — thread restaurante/staff
- `support_ticket_attachments` — metadados; arquivos no bucket `support-attachments`

### 9.3 Categorias

`bug`, `billing`, `payments`, `nfe`, `account`, `feature`, `other`

### 9.4 Status

`open` → `in_progress` → `waiting_customer` → `resolved` → `closed`

---

## 10. Sistema de Pagamentos (Qomanda Pay / Asaas)

### 10.1 Modelo comercial (v4.0) — recebimento 100% no restaurante

> **Atualização v4.0:** o modelo padrão **não usa mais split na hora da venda**.
> O pagamento cai **100% na conta do restaurante** (PIX manual ou Asaas do próprio
> restaurante) e a Qomanda fatura **mensalmente** (mensalidade + comissão sobre o
> GMV digital). Ver **§19.2** (gateway por restaurante) e **§19.4** (cobrança mensal).
> O marketplace split Asaas continua no código como **opção legada**, não padrão.

```
Pagamento do cliente → conta do restaurante (PIX manual / Asaas do restaurante)
                          │
Qomanda fatura no dia 5 ──┴─→ mensalidade do plano + comissão % sobre GMV digital
```

Taxas/comissão vêm do plano (`plans`) ou overrides em `restaurant_subscriptions`.

### 10.2 Modos de fechamento

#### Modo Individual
- O cliente paga apenas o seu consumo
- Valor sugerido = `min(meu_consumo, saldo_restante_da_mesa)`
- Se outros já pagaram a mais, o saldo beneficia automaticamente o último pagador
- O cliente pode pagar **a mais** do que deve → excedente vira saldo da mesa

#### Modo Mesa Toda
- Um cliente (iniciador) inicia o fechamento coletivo
- **Anti-fraude:** o iniciador está marcado e bloqueado — não pode se desmarcar
- O iniciador seleciona quem mais vai dividir
- Define valores: **igualmente** ou **personalizado**
  - Se personalizado: soma dos valores deve ser **exatamente** igual ao saldo restante
  - Validação em tempo real — CTA desabilitado enquanto não fecha

### 10.3 Notificação e confirmação

```
A inicia Mesa Toda, seleciona B e C
        │
        ▼
Cria close_request + close_request_participants
        │
        ▼
Supabase Realtime → B e C recebem notificação
        │
        ▼
Banner no home de B e C:
"João quer fechar a mesa. Sua parte: R$233. [Confirmar e Pagar]"
        │
        ▼
B confirma → checkout abre com valor pré-definido e bloqueado
B não pode editar o valor em modo Mesa Toda
        │
        ▼
B escolhe PIX / Débito / Crédito → paga
        │
        ▼
WhatsApp enviado para B com a nota
```

### 10.4 Saldo da mesa (crédito)

O saldo é calculado em tempo real:

```
saldo_restante = grand_total - soma(payments.amount WHERE session_id = X AND status = 'paid')
```

Quando João paga Individual com valor extra (ex: R$100 para uma conta de R$78):
- R$22 fica como crédito da mesa
- O próximo pagador individual verá: `valor_sugerido = min(consumo, saldo_restante)`
- Quem pagar por último se beneficia do crédito automaticamente

### 10.5 Split de recibo por álcool

Para funcionários que precisam de reembolso corporativo:

```
Cliente abre Individual checkout
        │
        ▼
Sistema detecta contains_alcohol = true nos seus order_items
        │
        ▼
Banner: "Separar em dois recibos? (Empresa + Pessoal)"
        │
   Aceita split?
    │        │
   Sim       Não
    │        │
    ▼        ▼
2 transações  1 transação
2 códigos     1 código
2 WhatsApps   1 WhatsApp

🍽️ Alimentação → WhatsApp "Reembolsável"
🍷 Bebidas      → WhatsApp "Pessoal"
```

### 10.6 Cálculo de taxa de serviço

Taxa padrão: **10%** sobre o subtotal.

```
grand_total = subtotal × 1.1
```

O valor que cada cliente vê já inclui a taxa proporcional ao seu consumo.

### 10.7 Fluxo Asaas

```
POST /api/asaas/payments
    │
    ├─ PIX → cobrança Asaas + split → webhook confirma
    ├─ Crédito → tokenização + cobrança + split
    └─ Dinheiro → POST /api/payments/cash (confirmação manual no dashboard)

POST /api/asaas/webhook
    │
    └─ Atualiza payments.status = 'paid', dispara WhatsApp/recibo
```

Onboarding de repasse: `POST /api/dashboard/asaas/onboard` + cadastro bancário em `/api/dashboard/payout/bank-account`.

Modo bypass para testes: `src/lib/payment-bypass.ts` (desligar em produção).

### 10.8 Webhooks idempotentes + NF-e de serviço

**Idempotência** (`src/lib/webhook-idempotency.ts` + tabela `webhook_events`):

- `claimWebhookEvent(admin, { provider, eventId, ... })` grava o evento como `processing` (dedupe por `(provider, event_id)`). Entrega já `processed` → retorna `proceed=false` (ignora); `error`/`processing` → reprocessa e incrementa `attempts`.
- `finishWebhookEvent(admin, rowId, status)` marca `processed`/`error`.
- **Chave de dedupe** — Asaas: `evento:payment:status`; Mercado Pago: `payment:status` (após buscar o status no gateway). Só entregas do **mesmo estado** são ignoradas; transições reais (ex.: `pending → approved`) processam.
- Ambos os webhooks retornam `200` mesmo em erro (evita reenvio em loop); o erro fica registrado em `webhook_events`.

**NF-e de serviço** (Qomanda → restaurante) — emitida quando a fatura de mensalidade é paga:

```
billing_invoices.status = 'paid'
    │  (webhook Asaas da mensalidade  OU  "Registrar pagamento" no portal interno)
    ▼
emitServiceNfeForInvoice(admin, billingInvoiceId, { requirePaid })
    │  prestador = Qomanda (env QOMANDA_NFE_*) · tomador = CNPJ do restaurante
    ├─ sem credenciais → grava 'simulated' (fluxo testável)
    ├─ com credenciais → NFS-e via Focus NFe (adapter compartilhado)
    └─ e-mail do PDF ao e-mail comercial do restaurante
```

- Tabela `service_nfe_invoices` — **1 nota por fatura** (`unique(billing_invoice_id)`), idempotente.
- Config do prestador: `src/lib/nfe/qomanda-fiscal.ts` (`QOMANDA_NFE_TOKEN`, `QOMANDA_CNPJ`, `QOMANDA_NFE_ENVIRONMENT`, `QOMANDA_NFE_CNAE`, `QOMANDA_LEGAL_NAME`, `QOMANDA_NFE_SERVICE_DESCRIPTION`).
- API interna: `GET/POST /api/internal/clients/[id]/service-nfe` (listar / emitir manual).

### 10.8.1 Fila assíncrona (NF-e + WhatsApp fora do request)

`confirmPaymentRecord` **não emite NF-e inline** — enfileira um job e responde na
hora, para o checkout não travar/falhar se o provedor fiscal/WhatsApp estiver lento.

- Tabela `async_jobs` (status, attempts, `run_after`, last_error) + `lib/job-queue.ts`
  (`enqueueJob` best-effort, `processDueJobs` com claim otimista + retry/backoff
  exponencial 30s→2min→8min…). `run_after` usa relógio do app (evita skew com o DB).
- Worker: `GET/POST /api/cron/process-jobs` (auth `CRON_SECRET`), agendado a cada
  minuto no `vercel.json`. Handlers: `nfe_emit` (idempotente) e `whatsapp_send`.
- **WhatsApp em fila**: `emitNfeForPayment` não envia inline — enfileira `whatsapp_send`
  (retry próprio + **throttle por restaurante** 20/min via `consumeRateLimit`; ao
  estourar, o handler retorna `{ deferSec }` e o worker reagenda sem consumir tentativa).
  Ao enviar, marca `nfe_invoices.whatsapp_sent_at`.
- Degradável: sem a tabela, `enqueueJob` falha silenciosamente sem quebrar o pagamento.

### 10.9 Chamar Garçom (notificação realtime)

```
Cliente (home) → POST /api/customer/call-waiter { sessionId }
    │  throttle 90s por sessão · grava restaurant_notifications type='call_waiter'
    ▼
realtime (postgres_changes, INSERT, restaurant_id)
    ├─ App do garçom: WaiterCallsBanner (toast + banner "Atender")
    └─ Dashboard: DashboardNotificationBell (toast + chime + badge)
```

> ⚠️ A entrega realtime exige a tabela na publicação `supabase_realtime` (`migrate-realtime-notifications.sql`). Sem isso o `channel` assina mas **não** recebe eventos.

---

## 11. Programa de Fidelidade

### 11.1 Como funciona

1. Cliente faz check-in → `customer_visits` recebe 1 registro (upsert por `session_id`)
2. Admin configura regras em **Settings → Fidelidade**
3. Sistema conta visitas: `SELECT COUNT(*) FROM customer_visits WHERE customer_id = X AND restaurant_id = Y`
4. Quando atinge o threshold → benefício exibido para o garçom na comanda

### 11.2 Tipos de benefício

| Tipo | Valor de exemplo |
|------|-----------------|
| `free_drink` | "Chope ou refrigerante grátis" |
| `free_item` | "Sobremesa grátis" |
| `discount_pct` | "10% de desconto na conta" |
| `custom` | Texto livre definido pelo admin |

### 11.3 Regras de configuração (admin)

- Múltiplas regras por restaurante (ex: 5 visitas = drink grátis, 10 visitas = 10% off)
- Cada regra pode ser ativada/desativada individualmente
- Ordenação automática por número de visitas

### 11.4 Tela de perfil do cliente

O cliente vê:
- Total de visitas no restaurante
- Barra de progresso até o próximo benefício
- Nome do próximo benefício

---

## 12. Integração WhatsApp e NF-e

### 12.1 WhatsApp Business API (Meta Cloud API)

**Pré-requisitos:**
1. Conta Business no Meta for Developers
2. WhatsApp Business Account aprovada
3. Número de telefone verificado
4. Phone Number ID + Access Token permanente

**Configuração:** restaurante em `Settings → Integrações → WhatsApp Business API`

APIs:
- `GET/POST /api/dashboard/integrations/whatsapp` — salvar credenciais
- `POST /api/dashboard/integrations/whatsapp/test` — enviar mensagem de teste

Staff (portal interno) vê status somente leitura na ficha do cliente (aba NF-e cliente).

**Rota:** `POST /api/whatsapp`

```typescript
// Payload
{
  to: string,           // número do cliente (dígitos)
  restaurantId: string, // para buscar as credenciais
  message: string       // corpo da mensagem (markdown WhatsApp)
}
```

**Formatação do número:** converte automaticamente para E.164
- 11 dígitos → `55{numero}` (Brasil)
- Já com 55 → mantém

**Mensagem enviada após pagamento:**
```
🧾 *Nome do Restaurante*
Mesa: 04 | Data: 30/05/2026

*Itens:*
• 2x Pão de Alho — R$25,80
• 1x Suco Natural — R$14,00

*Total: R$43,78*

Código de confirmação: *XKQZ91*

_A NF-e será emitida pelo restaurante e enviada em seguida._
```

**Em modo de desenvolvimento:** a mensagem é logada no console e não enviada.

### 12.2 NF-e — ao consumidor e de serviço (ambas implementadas)

**NF-e ao consumidor** (restaurante → cliente) — **implementado** (ver §19.3):
- Tipo por restaurante: **NFC-e** (modelo 65) ou **NFS-e**, definido no portal interno
- Emissão automática após pagamento confirmado (`confirmPaymentRecord`)
- Envio do link ao cliente por WhatsApp; histórico no painel + recibo do cliente
- Adapter Focus NFe pronto; **modo simulado** quando sem token (fluxo testável)

**NF-e de serviço** (Qomanda → restaurante) — **implementado** (ver §10.8):
- Mensalidade + comissão — emitida ao pagar a fatura (webhook Asaas ou "Registrar pagamento" interno)
- Prestador = Qomanda (env `QOMANDA_NFE_*`); tomador = CNPJ do restaurante
- **Modo simulado** sem credenciais; e-mail do PDF ao restaurante; aba **NF-e serviço** mostra status real + emissão manual

---

## 13. Regras de Negócio

### Mesa

| Regra | Detalhe |
|-------|---------|
| Uma sessão aberta por mesa | Se a mesa já tem sessão `open`, novos check-ins entram nela |
| Status automático | Trigger SQL atualiza `tables.status` quando `sessions.status` muda |
| Histórico de trocas | `table_history` JSONB registra todas as trocas de mesa |

### Cliente

| Regra | Detalhe |
|-------|---------|
| Identificação primária | WhatsApp (obrigatório, único) |
| Identificação secundária | CPF (opcional) — tem precedência no upsert se informado |
| Upsert por hash CPF | Busca por `cpf_hash` (HMAC). Encontrou → atualiza nome/WhatsApp. Não encontrou → upsert por WhatsApp |
| CPF nunca em texto puro | Armazenado como `cpf_hash` (HMAC-SHA256) + `cpf_encrypted` (AES-256-GCM) |
| Consentimento LGPD | Exibido no formulário de check-in antes de coletar CPF |
| Dados no browser | Browser só conhece `sessionId`, `customerId` (UUID) e nome — nunca CPF nem WhatsApp |

### Pagamento

| Regra | Detalhe |
|-------|---------|
| Mínimo individual | O cliente deve pagar pelo menos seu consumo (não pode pagar menos) |
| Máximo individual | Sem limite — excedente vira saldo da mesa |
| Mesa Toda — soma exata | A soma dos valores definidos deve ser **= saldo restante**. O sistema bloqueia se não fechar |
| Iniciador bloqueado | No modo Mesa Toda, o iniciador não pode se desmarcar (anti-fraude) |
| Saldo da mesa | `saldo_restante = grand_total - soma(payments WHERE status = 'paid')` |
| Último pagador beneficiado | `valor_sugerido = min(consumo, saldo_restante)` — crédito flui naturalmente |

### Pedidos

| Regra | Detalhe |
|-------|---------|
| Status sequencial | `pending → confirmed → preparing → ready → delivered` |
| `updated_at` automático | Trigger SQL atualiza a cada mudança de status |
| Cancelamento | Possível em qualquer status (pelo admin) |

### Fidelidade

| Regra | Detalhe |
|-------|---------|
| 1 visita por sessão | `unique(session_id)` em `customer_visits` impede contagem dupla |
| Contagem por restaurante | Visitas são contadas separadamente por restaurante |
| Regras ordenadas | Múltiplas regras ordenadas por `visit_count` crescente |

---

## 14. Segurança e LGPD

### 14.1 Modelo de ameaças

| Ameaça | Risco sem mitigação | Mitigação implementada |
|--------|--------------------|-----------------------|
| Extração em massa de PII | Alto — `ANON_KEY` é pública | `public_select` removido de `customers` e `customer_visits` |
| Vazamento de CPF | Crítico — dado sensível LGPD | CPF nunca armazenado em texto puro |
| Restaurante A ver dados do B | Médio | RLS por `restaurant_id` no dashboard |
| Falsificação de check-in | Baixo | Toda lógica é server-side com service role |
| Ataque via UUID de sessão | Baixo | UUID v4 tem 122 bits de entropia |

---

### 14.2 Camadas de segurança

```
┌─────────────────────────────────────────────────────┐
│  Browser (cliente)                                  │
│  • Supabase ANON KEY (pública)                      │
│  • Acesso restrito por RLS                          │
│  • NUNCA acessa: customers, customer_visits         │
└──────────────────────┬──────────────────────────────┘
                       │ HTTPS
┌──────────────────────▼──────────────────────────────┐
│  API Routes (Next.js — server-side)                 │
│  • /api/checkin           → service role            │
│  • /api/customer/profile  → service role            │
│  • /api/payments          → service role            │
│  • /api/internal/*        → requireStaff + service role │
│  • Validação de entrada em todas as rotas           │
└──────────────────────┬──────────────────────────────┘
                       │ service_role_key (secreta)
┌──────────────────────▼──────────────────────────────┐
│  Supabase / PostgreSQL                              │
│  • RLS ativo em todas as 14 tabelas                 │
│  • CPF armazenado cifrado                           │
│  • Índices por hash (não por valor)                 │
└─────────────────────────────────────────────────────┘
```

---

### 14.3 Row Level Security — mapa completo

| Tabela | Acesso público (ANON) | Acesso admin (auth) |
|--------|----------------------|---------------------|
| `restaurants` | ✗ nenhum | ✓ owner_all (só o próprio) |
| `tables` | ✗ nenhum | ✓ owner_all (só do próprio restaurante) |
| `customers` | INSERT apenas (check-in via API) | ✓ SELECT clientes do próprio restaurante |
| `sessions` | INSERT + SELECT + UPDATE status | ✓ UPDATE pelo dono |
| `session_participants` | INSERT + SELECT + UPDATE | — |
| `menu_categories` | SELECT (leitura do cardápio) | ✓ owner_all |
| `menu_items` | SELECT (leitura do cardápio) | ✓ owner_all |
| `orders` | INSERT + SELECT | ✓ UPDATE status |
| `order_items` | INSERT + SELECT + UPDATE | — |
| `payments` | INSERT + SELECT | ✓ UPDATE (confirmação) |
| `close_requests` | INSERT + SELECT + UPDATE | — |
| `close_request_participants` | INSERT + SELECT + UPDATE | — |
| `loyalty_rules` | SELECT (ativas apenas) | ✓ owner_all |
| `customer_visits` | INSERT apenas | ✓ SELECT do próprio restaurante |

> **Por que `sessions`, `orders`, `payments` têm SELECT público?**
> O cliente precisa acompanhar seus pedidos em tempo real. O `session_id` (UUID v4 —
> 122 bits de entropia) funciona como um "token de acesso" — virtualmente impossível
> de adivinhar. Na Fase 2, com autenticação OTP, essas policies serão restritas
> por `auth.uid()`.

---

| `plans`, `staff_users`, `restaurant_subscriptions`, `billing_invoices` | ✗ nenhum | ✗ service role only |
| `support_tickets`, `support_ticket_messages` | ✗ nenhum | ✓ via API autenticada |

### 14.4 Criptografia de CPF

O CPF é dado sensível para fins de LGPD. Nunca é armazenado em texto puro.

**Dois campos substituem a coluna `cpf` antiga:**

```
cpf_hash      — HMAC-SHA256(CPF, CPF_HASH_SALT)
cpf_encrypted — AES-256-GCM(CPF, CPF_ENCRYPTION_KEY)
```

**Módulo:** `src/lib/crypto.ts`

| Função | Uso | Reversível |
|--------|-----|-----------|
| `hashCPF(cpf)` | Lookup e unicidade no banco | Não |
| `encryptCPF(cpf)` | Armazenamento para NF-e futura | Sim (service role) |
| `decryptCPF(data)` | Recuperar CPF para NF-e | Sim (apenas server-side) |
| `maskCPFDisplay(cpf)` | Exibir `***.456.789-**` | N/A |

**Fluxo de check-in com CPF:**

```
Cliente informa CPF "123.456.789-09"
              │
              ▼  (server-side: /api/checkin)
hashCPF("12345678909")    → "a3f8c..." (salvo em cpf_hash)
encryptCPF("12345678909") → "iv:enc:tag" (salvo em cpf_encrypted)
              │
              ▼
Banco: cpf_hash = "a3f8c...", cpf_encrypted = "iv:enc:tag"
              │
              ▼  (verificação de retorno)
hashCPF(input) == cpf_hash → cliente reconhecido
```

**Geração das chaves (fazer uma vez, guardar em segredo):**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# → use o output como CPF_ENCRYPTION_KEY (32 bytes = 64 chars hex)
# → use outro output como CPF_HASH_SALT
```

> **ATENÇÃO:** Se `CPF_HASH_SALT` for alterado, os hashes antigos não casamais com
> novos inputs. Clientes não serão reconhecidos. **Nunca altere em produção.**

---

### 14.5 Padrão service role

A `SUPABASE_SERVICE_ROLE_KEY` bypassa completamente o RLS. Só é usada server-side:

```typescript
// src/lib/supabase/admin.ts
import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,  // NUNCA expor no browser
    { auth: { persistSession: false } }
  )
}
```

**Regra:** se uma API route usa `createAdminClient()`, ela **deve** validar a
legitimidade da requisição (parâmetros obrigatórios, existência do recurso) antes
de executar qualquer operação de escrita.

---

### 14.6 O que ainda falta (Fase 2)

| Feature | Benefício | Complexidade |
|---------|-----------|-------------|
| Autenticação OTP WhatsApp | RLS por `auth.uid()` em sessions/orders/payments | Alta |
| Criptografia de WhatsApp | Proteção total do identificador primário | Média |
| Política de retenção de dados | LGPD: direito ao esquecimento | Média |
| Audit log | Rastrear quem acessou dados de clientes | Baixa |

---

## 15. API Routes

Rotas legadas Stripe (`/api/payments`, `/api/stripe/webhook`) permanecem como stub; produção usa **Asaas**.

### Portal interno (staff)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/internal/overview` | KPIs e séries do overview |
| GET/POST | `/api/internal/clients` | Listar / criar clientes |
| GET/PATCH | `/api/internal/clients/[id]` | Detalhe / atualizar cliente |
| GET/POST | `/api/internal/clients/[id]/invoices` | Faturas de mensalidade (POST `markPaid` emite NF-e serviço) |
| GET/POST | `/api/internal/clients/[id]/service-nfe` | NF-e de serviço (listar / emitir manual) |
| GET | `/api/internal/plans` | Catálogo de planos |
| GET/PATCH/POST | `/api/internal/gateway` | Config Asaas plataforma |
| GET | `/api/internal/support/tickets` | Fila de tickets |
| GET/PATCH/POST | `/api/internal/support/tickets/[id]` | Detalhe, status, resposta |

### Dashboard restaurante (seleção)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET/POST | `/api/dashboard/payout/bank-account` | Conta de repasse |
| GET/POST | `/api/dashboard/integrations/whatsapp` | Credenciais WhatsApp |
| GET/POST | `/api/dashboard/support/tickets` | Tickets do restaurante |

### Pagamentos Asaas

| Método | Rota | Descrição |
|--------|------|-----------|
| POST/GET | `/api/asaas/payments` | Criar/consultar cobrança |
| POST | `/api/asaas/webhook` | Confirmação Asaas (idempotente; pagto consumidor + mensalidade → NF-e serviço) |
| POST | `/api/mercadopago/webhook` | Confirmação Mercado Pago (idempotente) |
| POST | `/api/customer/call-waiter` | Cliente chama o garçom (notificação realtime) |

### `POST /api/checkin` ⚠️ server-side

Realiza o check-in do cliente. Usa service role — nunca acessada diretamente pelo browser.

**Body:**
```json
{
  "slug": "meu-restaurante",
  "mesa": "4",
  "firstName": "João",
  "lastName": "Silva",
  "whatsapp": "11999999999",
  "documentType": "cpf",
  "cpf": "12345678909"
}
```

**Response:**
```json
{ "sessionId": "uuid", "customerId": "uuid", "isJoining": false }
```

---

### `GET /api/customer/profile?session=UUID` ⚠️ server-side

Retorna dados seguros do cliente para exibição no perfil. CPF nunca retornado.

**Response:**
```json
{
  "firstName": "João", "lastName": "Silva",
  "whatsapp": "11999999999",
  "hasCpf": true, "documentType": "cpf",
  "visits": 3,
  "nextReward": { "visit_count": 5, "benefit_value": "Chope grátis" }
}
```

---

### `PATCH /api/customer/profile` ⚠️ server-side

Atualiza nome do cliente. WhatsApp é imutável.

**Body:** `{ "sessionId": "uuid", "firstName": "João", "lastName": "Novo" }`

---

### `POST /api/whatsapp`

Envia mensagem via Meta WhatsApp Cloud API.

**Body:** `{ "to": "11999999999", "restaurantId": "uuid", "message": "texto" }`

---

## 16. Variáveis de Ambiente

Criar o arquivo `.env.local` na raiz do projeto:

```bash
# Supabase (obrigatório)
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Criptografia CPF (gerar: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
CPF_ENCRYPTION_KEY=
CPF_HASH_SALT=

# Asaas — Qomanda Pay
ASAAS_API_KEY=$aact_YourKeyHere
ASAAS_ENVIRONMENT=sandbox          # ou production
ASAAS_WEBHOOK_TOKEN=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_DEV_BYPASS=true        # apenas dev local

# Portal interno
QOMANDA_STAFF_EMAILS=ops@qomanda.com
PLATFORM_SECRETS_KEY=              # credenciais gateway plataforma (64 hex)

# NF-e de serviço (Qomanda → restaurante) — opcional; sem isto roda em modo simulado
QOMANDA_NFE_TOKEN=                 # token Focus NFe da Qomanda (prestador)
QOMANDA_CNPJ=                      # CNPJ da Qomanda
QOMANDA_NFE_ENVIRONMENT=homologacao  # ou producao
QOMANDA_NFE_CNAE=                  # opcional
QOMANDA_LEGAL_NAME=Qomanda Tecnologia
QOMANDA_NFE_SERVICE_DESCRIPTION=Assinatura e taxas da plataforma Qomanda

# Mercado Pago OAuth (onboarding por restaurante) — opcional; sem isto, só token manual
# Redirect URI a cadastrar no app MP: https://qomanda.app/api/dashboard/gateway/mercadopago/callback
MERCADO_PAGO_CLIENT_ID=
MERCADO_PAGO_CLIENT_SECRET=

# Observabilidade (Sentry) — opcional; sem DSN o SDK não é carregado (no-op)
SENTRY_DSN=                          # server (API routes, jobs, webhooks)
NEXT_PUBLIC_SENTRY_DSN=              # client (browser)
SENTRY_TRACES_SAMPLE_RATE=0          # opcional (0–1) — tracing de performance
NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=0

# Rate limiting — opcional; sem isto usa janela fixa em memória (por instância)
UPSTASH_REDIS_REST_URL=             # rate limit distribuído (Upstash REST, sem SDK)
UPSTASH_REDIS_REST_TOKEN=
```

---

## 17. Configuração Inicial (Supabase)

### Passo 1 — Criar projeto

1. Acesse [supabase.com](https://supabase.com) e crie um novo projeto
2. Anote URL e anon key (Settings → API)

### Passo 2 — Schema base

1. SQL Editor → cole `supabase/schema.sql` → Execute

### Passo 3 — Migrações incrementais

Rodar em ordem (ver também [ROADMAP.md](../ROADMAP.md)):

| Migração | Conteúdo |
|----------|----------|
| `migrate-internal-portal.sql` | Planos, assinaturas, staff, faturas |
| `migrate-asaas-marketplace.sql` | Split/taxas por restaurante |
| `migrate-restaurant-payout-bank.sql` | Conta bancária repasse |
| `migrate-restaurant-business-profile.sql` | Perfil empresarial |
| `migrate-restaurant-nfe.sql` | NF-e ao consumidor |
| `migrate-platform-asaas-config.sql` | Credenciais Asaas plataforma |
| `migrate-support-tickets.sql` | Suporte + bucket anexos |

Demais arquivos `migrate-*.sql` cobrem hub, PIN, cash, fidelidade, etc.

### Passo 4 — Realtime

Database → Replication — habilitar: `orders`, `order_items`, `sessions`, `tables`, `close_request_participants`, `session_participants`, `payments`.

### Passo 5 — Staff e primeiro restaurante

```bash
node scripts/setup-internal-staff.mjs
```

Restaurante piloto: portal interno `/internal/clients/new` ou `/cadastro`.

### Modo desenvolvimento

Com `NEXT_PUBLIC_DEV_BYPASS=true`:

| Fluxo | URL |
|-------|-----|
| Login admin | `/login` |
| Portal interno | `/internal` |
| Cliente | `/scan` |

---

## 18. Roadmap

Ver [ROADMAP.md](../ROADMAP.md) para status detalhado.

| Fase | Foco |
|------|------|
| **Fechamento (Jun 2026)** | Qomanda Pay prod, NF-e automática, cobrança SaaS |
| **Lançamento** | Onboarding self-service, fidelidade persistida |
| **Crescimento** | Analytics, app garçom, equipe, 2FA |
| **Escala** | Multi-unidades, integrações, reservas |

---

## 19. Módulos & Funcionalidades (v4.0)

Esta seção descreve os módulos entregues, sua estrutura de arquivos e como cada um funciona.

### 19.1 Modelos operacionais (tipo de restaurante)

O restaurante opera em um de quatro **modelos**, que definem o fluxo do cliente e adaptam o painel.

| Modelo | `restaurant_model` | `operational_mode` | Entrada do cliente |
|--------|--------------------|--------------------|--------------------|
| Salão com mesas | `salao` | `dine_in` | QR na mesa (`/{slug}?mesa=&t=`) |
| Balcão / fast food | `balcao` | `counter` | Link `/{slug}/balcao` → pedido #N |
| Salão + balcão | `salao_balcao` | `both` | `/{slug}` oferece escolha |
| Food hall / praça | `food_hall` | `counter` | Igual balcão, título "Praça de alimentação" |

**Onde se define o tipo:**
- **Self-cadastro** (`/cadastro`): etapa de escolha do modelo (aplica preset).
- **Portal interno** (`/internal/clients/[id]` → aba Estabelecimento): `RestaurantModelPicker`.

**Preset aplicado** (`restaurantModelPresetToDb`): grava `restaurant_model`,
`operational_mode`, `marketplace_split_enabled`. Não sobrescreve o gateway já configurado.

**Painel adaptado por tipo** (a partir de `RestaurantAccess.operationalMode`):
- **Sidebar** (`components/dashboard/sidebar.tsx`): esconde "Mesas" no balcão puro.
- **Overview** (`overview-live-dashboard.tsx`): balcão troca "Mesas Ocupadas/Mapa de
  Mesas" por "Pedidos Hoje" + painel "Balcão" com link de divulgação (`OverviewCounterPanel`).
- **Página de Mesas**: aviso quando o restaurante é balcão.

**Arquivos-chave:** `lib/restaurant-models.ts`, `lib/restaurant-auth.ts` (resolve
`operationalMode`/`restaurantModel`), `components/internal/restaurant-model-picker.tsx`.
**Specs detalhadas por modelo:** `docs/modulos/SALAO.md`, `BALCAO.md`, `SALAO_BALCAO.md`, `FOOD_HALL.md`.

### 19.2 Gateway de pagamento por restaurante

Cada restaurante escolhe como recebe (Settings → Pagamentos):
- **PIX manual**: cliente vê a chave PIX no checkout, transfere e o restaurante confirma.
- **Asaas**: PIX/cartão automáticos na conta Asaas do próprio restaurante.
- **Dinheiro**: sempre disponível, sem comissão.

O recebimento é **100% do restaurante**; a Qomanda cobra comissão na fatura mensal.

**API:** `GET/POST /api/dashboard/gateway` (`requireOwnerAccess`). Campos em `restaurants`:
`payment_gateway_provider`, `payment_gateway_api_key_encrypted`, `manual_pix_key`,
`manual_pix_key_type`, `manual_payment_holder_name`, `operational_mode`.
**Libs:** `restaurant-gateway.ts`, `restaurant-payment-config.ts`, `payment-gateway-resolve.ts`.

> **Nota de auth (v4.0):** `requireRestaurantAccess` resolve sempre o restaurante
> **real** do usuário autenticado; o mock (`DEV_BYPASS`) só vale sem login. Isso
> corrigiu o bug em que escritas de dono iam para um `mock-restaurant-id` inexistente.

### 19.3 NF-e — emissão + envio por WhatsApp

Após o pagamento confirmado, emite a nota e envia o link ao cliente.

**Fluxo:** `confirmPaymentRecord` → (se `nfe_enabled` + `nfe_auto_emit` + `nfe_status=active`)
→ `emitNfeForPayment` → registra em `nfe_invoices` → envia WhatsApp (se `whatsapp_nfe_enabled`).

- **Abstração de provedor:** `lib/nfe/types.ts` (`NfeProviderAdapter`).
- **Adapter Focus NFe:** `lib/nfe/focus-nfe.ts` — NFC-e (modelo 65) e NFS-e, respeita
  ambiente homologação/produção. **Modo simulado** quando não há token (grava
  `status='simulated'`), tornando o fluxo testável ponta a ponta.
- **Orquestrador:** `lib/nfe/emit-nfe.ts` — idempotente por pagamento; nunca lança.
- **Tipo de nota por restaurante** (`nfe_note_type`): NFC-e ou NFS-e (portal interno).
- **Envio WhatsApp:** `lib/send-whatsapp.ts` (mock em dev sem credenciais).

**APIs:** `POST /api/dashboard/nfe/emit` (manual/retry), `GET /api/dashboard/nfe` (lista),
`POST /api/dashboard/nfe/resend` (reenvia WhatsApp).
**UI:** aba **Notas Fiscais** no Settings (todos os módulos) + coluna NF-e no histórico
de transações; no lado do cliente, botão **Baixar NF-e** no hub de recibos.
**Tabela:** `nfe_invoices` (status, note_type, danfe_url, access_key, whatsapp_sent_at…).

### 19.4 Cobrança automática da mensalidade

Todo dia 5, gera a fatura de cada restaurante ativo e cria a cobrança PIX na conta
**master** da Qomanda no Asaas (billing padrão, sem marketplace).

- **Cálculo:** `commission-billing.ts` (`previewRestaurantMonthlyBill`) = mensalidade do
  plano + comissão progressiva sobre o GMV digital do mês.
- **Geração + cobrança:** `lib/monthly-billing.ts` (`generateMonthlyInvoice`, idempotente
  por período). Cria o restaurante como **cliente** no Asaas master (`ensureBillingCustomer`)
  e gera a cobrança PIX (`createPixPayment`).
- **Agendamento:** `GET/POST /api/cron/monthly-billing` protegido por `CRON_SECRET`.
  `vercel.json` agenda GET dia 5 às 09:00 (Vercel envia o secret no header).
- **Conciliação:** webhook Asaas (`/api/asaas/webhook`) — cobrança sem pagamento de
  consumidor cai em `billing_invoices` e é marcada `paid`/`overdue`/`cancelled`. Ao marcar
  `paid`, dispara a **NF-e de serviço** (§19.6).

**Tabela:** `billing_invoices` (+ `asaas_payment_id`, `charge_method`, `invoice_url`,
`period_year/month`, único por `restaurant_id+period_start`); `restaurants.asaas_billing_customer_id`.

### 19.6 Webhooks idempotentes · NF-e de serviço · Chamar Garçom

**Webhooks idempotentes** (`lib/webhook-idempotency.ts` + `webhook_events`):
- `claimWebhookEvent`/`finishWebhookEvent` deduplicam por `(provider, event_id)`. Asaas usa
  `evento:payment:status`; Mercado Pago `payment:status`. Reentrega do mesmo estado é
  ignorada (`duplicate:true`); transição real reprocessa. Erros ficam logados na tabela.

**NF-e de serviço** (Qomanda → restaurante) — `lib/nfe/emit-service-nfe.ts`:
- Gatilho automático ao marcar `billing_invoices.paid` (webhook Asaas + "Registrar
  pagamento" interno) e manual via `POST /api/internal/clients/[id]/service-nfe`.
- Prestador = Qomanda (`lib/nfe/qomanda-fiscal.ts`, env `QOMANDA_NFE_*`); tomador = CNPJ do
  restaurante. Reusa o `FocusNfeAdapter` (NFS-e). **Simulado** sem credenciais.
- `service_nfe_invoices` (único por `billing_invoice_id`); e-mail do PDF ao restaurante.
- **UI:** aba **NF-e serviço** do cliente interno — status real, botão emitir, link PDF.

**Chamar Garçom** (notificação realtime) — `POST /api/customer/call-waiter`:
- Grava `restaurant_notifications type='call_waiter'` (throttle 90s/sessão). Entrega por
  `postgres_changes` ao **app do garçom** (`WaiterCallsBanner`) e ao **dashboard**
  (`DashboardNotificationBell`: toast + chime + badge).
- Exige a tabela na publicação `supabase_realtime` (`migrate-realtime-notifications.sql`).

### 19.7 Migrações relacionadas (v4.0)

Rodar no Supabase (ordem em `ROADMAP.md` § Migrações):
`migrate-commercial-restaurant-account.sql`, `migrate-restaurant-model.sql`,
`migrate-restaurant-manual-payment.sql`, `migrate-tables-public-read.sql`,
`migrate-nfe-invoices.sql`, `migrate-billing-charge.sql`,
`migrate-call-waiter.sql`, `migrate-realtime-notifications.sql`,
`migrate-webhook-events.sql`, `migrate-service-nfe.sql`.

---

*Documento mantido pela equipe Qomanda · contato@qomanda.com.br*
