# Qomanda — Documentação Técnica Completa

> Versão 2.0 · Atualizado em 2026-05-30

---

## Índice

1. [Visão Geral do Produto](#1-visão-geral-do-produto)
2. [Arquitetura do Sistema](#2-arquitetura-do-sistema)
3. [Stack Tecnológico](#3-stack-tecnológico)
4. [Estrutura de Arquivos](#4-estrutura-de-arquivos)
5. [Modelo de Dados](#5-modelo-de-dados)
6. [Fluxos do Cliente (PWA Mobile)](#6-fluxos-do-cliente-pwa-mobile)
7. [Fluxos do Admin (Dashboard)](#7-fluxos-do-admin-dashboard)
8. [Sistema de Pagamentos](#8-sistema-de-pagamentos)
9. [Programa de Fidelidade](#9-programa-de-fidelidade)
10. [Integração WhatsApp e NF-e](#10-integração-whatsapp-e-nf-e)
11. [Regras de Negócio](#11-regras-de-negócio)
12. [API Routes](#12-api-routes)
13. [Variáveis de Ambiente](#13-variáveis-de-ambiente)
14. [Configuração Inicial (Supabase)](#14-configuração-inicial-supabase)
15. [Modo Desenvolvimento (Demo)](#15-modo-desenvolvimento-demo)
16. [Roadmap](#16-roadmap)

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
          ┌────────────────┼────────────────┐
          │                │                │
    ┌─────▼─────┐   ┌──────▼──────┐  ┌─────▼──────┐
    │  PWA      │   │  Dashboard  │  │  API       │
    │  Cliente  │   │  Admin      │  │  Routes    │
    │  /[slug]  │   │  /dashboard │  │  /api/*    │
    └─────┬─────┘   └──────┬──────┘  └─────┬──────┘
          │                │               │
          └────────────────┼───────────────┘
                           │
                    ┌──────▼──────┐
                    │  Supabase   │
                    │  ┌────────┐ │
                    │  │Postgres│ │  (Banco de dados)
                    │  ├────────┤ │
                    │  │  Auth  │ │  (Autenticação do admin)
                    │  ├────────┤ │
                    │  │Realtime│ │  (WebSockets para pedidos)
                    │  ├────────┤ │
                    │  │Storage │ │  (Imagens do cardápio)
                    │  └────────┘ │
                    └──────┬──────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
    ┌─────▼─────┐   ┌──────▼──────┐  ┌─────▼──────┐
    │  Stripe   │   │  WhatsApp   │  │  SEFAZ     │
    │  (pgtos)  │   │  Business   │  │  (NF-e)    │
    │           │   │  API (Meta) │  │  Em breve  │
    └───────────┘   └─────────────┘  └────────────┘
```

### Padrão de comunicação

- **Cliente → Supabase:** chamadas diretas via SDK client-side (Row Level Security protege os dados)
- **Admin → Supabase:** chamadas server-side com session auth
- **Realtime:** Supabase Realtime (WebSocket) para pedidos, sessões e notificações
- **Pagamentos:** API route Next.js → Stripe → Webhook de confirmação
- **WhatsApp:** API route Next.js → Meta WhatsApp Cloud API

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
| Pagamentos | Stripe | 22.x |
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
├── supabase/
│   └── schema.sql             ← schema completo (rodar no Supabase)
├── src/
│   ├── app/
│   │   ├── (customer)/        ← grupo de rotas do cliente (sem auth)
│   │   │   └── [slug]/
│   │   │       ├── page.tsx         ← check-in (cadastro rápido)
│   │   │       ├── home/            ← hub pós check-in
│   │   │       ├── menu/            ← cardápio digital
│   │   │       ├── orders/          ← meus pedidos / mesa toda
│   │   │       ├── checkout/        ← pagamento
│   │   │       └── profile/         ← perfil do cliente
│   │   ├── (dashboard)/       ← grupo de rotas admin (com auth)
│   │   │   ├── login/               ← login do restaurante
│   │   │   └── dashboard/
│   │   │       ├── page.tsx         ← overview (KPIs + mapa de mesas)
│   │   │       ├── orders/          ← fila de pedidos (kanban)
│   │   │       ├── menu/            ← gestão do cardápio
│   │   │       ├── tables/          ← gestão de mesas + QR Codes
│   │   │       └── settings/        ← configurações (pagamentos, fidelidade, integrações)
│   │   ├── api/
│   │   │   ├── payments/            ← criação de pagamento + Stripe
│   │   │   ├── stripe/webhook/      ← confirmação de pagamento Stripe
│   │   │   └── whatsapp/            ← envio de mensagens WhatsApp
│   │   ├── cadastro/          ← cadastro de novos restaurantes
│   │   ├── scan/              ← scanner de QR Code (cliente)
│   │   ├── roadmap/           ← roadmap público
│   │   └── page.tsx           ← landing page de marketing
│   ├── components/
│   │   ├── customer/
│   │   │   └── bottom-nav.tsx       ← navegação inferior do cliente
│   │   ├── dashboard/
│   │   │   ├── sidebar.tsx
│   │   │   ├── header.tsx
│   │   │   ├── add-item-modal.tsx
│   │   │   ├── table-qr-modal.tsx
│   │   │   └── table-manage-modal.tsx
│   │   ├── ui/                      ← componentes Radix/shadcn
│   │   └── qomanda-logo.tsx         ← SVG do logo
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts            ← cliente browser
│   │   │   └── server.ts            ← cliente server-side
│   │   ├── stripe.ts                ← inicialização do Stripe
│   │   ├── utils.ts                 ← formatCurrency, generateConfirmationCode
│   │   └── dev-mock.ts              ← dados mock para desenvolvimento
│   └── types/
│       └── index.ts                 ← todos os tipos TypeScript
└── ROADMAP.md
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
| cpf | text | 11 dígitos, único — identificador secundário estável |
| passport | text | Para estrangeiros |

> **Regra de upsert:** na ordem CPF → WhatsApp. O CPF garante continuidade do histórico mesmo se o cliente trocar de número.

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

### 6.2 Check-in — regras de upsert do cliente

```
Cliente informa WhatsApp
        │
        ▼
 Tem CPF preenchido?
    │         │
   Sim        Não
    │         │
    ▼         ▼
Busca por   Busca por
CPF         WhatsApp
    │         │
Encontrou?  Encontrou?
  │    │     │    │
Sim   Não   Sim  Não
  │    │     │    │
  │  upsert  │  insert
  │  por WA  │
Atualiza   (mesmo cliente,
nome/WA    número novo)
    │         │
    └────┬────┘
         ▼
   customer_id resolvido
         │
         ▼
  Mesa tem sessão aberta?
    │             │
   Sim            Não
    │             │
  Entra na    Cria nova
  sessão      sessão
    │             │
    └──────┬───────┘
           ▼
  Insere session_participants
  Insere customer_visits
  Salva em localStorage:
    - qomanda_session_id
    - qomanda_customer_id
    - qomanda_customer_name
```

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
| Settings | `/dashboard/settings` | 4 abas: Pagamentos, Fidelidade, Integrações, Segurança, Equipe |

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

## 8. Sistema de Pagamentos

### 8.1 Modos de fechamento

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

### 8.2 Notificação e confirmação

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

### 8.3 Saldo da mesa (crédito)

O saldo é calculado em tempo real:

```
saldo_restante = grand_total - soma(payments.amount WHERE session_id = X AND status = 'paid')
```

Quando João paga Individual com valor extra (ex: R$100 para uma conta de R$78):
- R$22 fica como crédito da mesa
- O próximo pagador individual verá: `valor_sugerido = min(consumo, saldo_restante)`
- Quem pagar por último se beneficia do crédito automaticamente

### 8.4 Split de recibo por álcool

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

### 8.5 Cálculo de taxa de serviço

Taxa padrão: **10%** sobre o subtotal.

```
grand_total = subtotal × 1.1
```

O valor que cada cliente vê já inclui a taxa proporcional ao seu consumo.

### 8.6 Fluxo Stripe

```
POST /api/payments
    │
    ├─ PIX/Débito → cria Payment record com status 'pending'
    │               │
    │               ▼
    │           Cliente confirma manualmente → status 'paid'
    │           WhatsApp enviado
    │
    └─ Crédito  → Stripe PaymentIntent criado
                  │
                  ▼
              Frontend: stripe.confirmCardPayment(client_secret)
                  │
                  ▼
              Stripe Webhook → POST /api/stripe/webhook
                  │
                  ▼
              payments.update({ status: 'paid', paid_at: now() })
              WhatsApp enviado
```

---

## 9. Programa de Fidelidade

### 9.1 Como funciona

1. Cliente faz check-in → `customer_visits` recebe 1 registro (upsert por `session_id`)
2. Admin configura regras em **Settings → Fidelidade**
3. Sistema conta visitas: `SELECT COUNT(*) FROM customer_visits WHERE customer_id = X AND restaurant_id = Y`
4. Quando atinge o threshold → benefício exibido para o garçom na comanda

### 9.2 Tipos de benefício

| Tipo | Valor de exemplo |
|------|-----------------|
| `free_drink` | "Chope ou refrigerante grátis" |
| `free_item` | "Sobremesa grátis" |
| `discount_pct` | "10% de desconto na conta" |
| `custom` | Texto livre definido pelo admin |

### 9.3 Regras de configuração (admin)

- Múltiplas regras por restaurante (ex: 5 visitas = drink grátis, 10 visitas = 10% off)
- Cada regra pode ser ativada/desativada individualmente
- Ordenação automática por número de visitas

### 9.4 Tela de perfil do cliente

O cliente vê:
- Total de visitas no restaurante
- Barra de progresso até o próximo benefício
- Nome do próximo benefício

---

## 10. Integração WhatsApp e NF-e

### 10.1 WhatsApp Business API (Meta Cloud API)

**Pré-requisitos:**
1. Conta Business no Meta for Developers
2. WhatsApp Business Account aprovada
3. Número de telefone verificado
4. Phone Number ID + Access Token permanente

**Configuração no admin:** `Settings → Integrações → WhatsApp Business API`

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

### 10.2 NF-e (Nota Fiscal Eletrônica) — Em Breve

**Estrutura preparada**, integração pendente de provedor.

**O que o restaurante precisa:**
- CNPJ ativo com Inscrição Estadual
- Certificado Digital A1 (.pfx)
- Conta em provedor homologado: Focus NFe, NFe.io, Nota Simples, etc.

**Comportamento planejado:**
1. Pagamento confirmado → trigger de emissão de NF-e
2. NF-e processada pelo provedor → PDF gerado
3. PDF enviado via WhatsApp para CPF do cliente
4. Se split por álcool: duas NF-e separadas (alimentação + bebidas)

---

## 11. Regras de Negócio

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
| Identificação secundária | CPF (opcional, único) — tem precedência no upsert |
| Upsert por CPF | Se o cliente informou CPF e já existe no banco, atualiza WhatsApp sem criar duplicata |
| Dados LGPD | CPF armazenado sem formatação; consentimento exibido no formulário de check-in |

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

## 12. API Routes

### `POST /api/payments`

Cria um pagamento e (se cartão de crédito) um Stripe PaymentIntent.

**Body:**
```json
{
  "session_id": "uuid",
  "amount": 67.98,
  "method": "pix" | "debit" | "credit"
}
```

**Response:**
```json
{
  "payment_id": "uuid",
  "client_secret": "pi_xxx_secret_xxx"  // apenas para crédito
}
```

---

### `POST /api/stripe/webhook`

Recebe eventos do Stripe. Valida assinatura e processa `payment_intent.succeeded`.

**Eventos tratados:**
- `payment_intent.succeeded` → `payments.update({ status: 'paid' })`

---

### `POST /api/whatsapp`

Envia mensagem via Meta WhatsApp Cloud API.

**Body:**
```json
{
  "to": "11999999999",
  "restaurantId": "uuid",
  "message": "texto da mensagem"
}
```

**Response:**
```json
{
  "success": true,
  "messageId": "wamid.xxx"
}
```

Em desenvolvimento sem credenciais: `{ "success": true, "mock": true }`

---

## 13. Variáveis de Ambiente

Criar o arquivo `.env.local` na raiz do projeto:

```bash
# Supabase (obrigatório)
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
# Service Role Key — NUNCA expor no frontend — usar apenas server-side
# Encontrar em: Supabase Dashboard → Settings → API → service_role key
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Stripe (necessário para pagamentos com cartão)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# URL pública (para geração dos QR Codes)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Modo desenvolvimento (pula autenticação e usa dados mock)
NEXT_PUBLIC_DEV_BYPASS=true
```

---

## 14. Configuração Inicial (Supabase)

### Passo 1 — Criar projeto

1. Acesse [supabase.com](https://supabase.com) e crie um novo projeto
2. Anote a **URL** e a **anon key** (Settings → API)

### Passo 2 — Executar o schema

1. Vá em **SQL Editor** no Supabase Dashboard
2. Cole o conteúdo de `supabase/schema.sql`
3. Execute

### Passo 3 — Habilitar Realtime

1. Vá em **Database → Replication**
2. Habilite as seguintes tabelas:
   - `orders`
   - `order_items`
   - `sessions`
   - `tables`
   - `close_request_participants`
   - `session_participants`
   - `payments`

### Passo 4 — Criar primeiro restaurante

Com o sistema rodando, acesse `/cadastro` e crie um restaurante. Ou use o modo demo (veja abaixo).

---

## 15. Modo Desenvolvimento (Demo)

Para desenvolvimento sem banco de dados, use o modo demo:

```bash
NEXT_PUBLIC_DEV_BYPASS=true
```

### Acesso rápido

| Fluxo | URL |
|-------|-----|
| Login admin (sem senha) | `/login` → "Entrar no Painel" |
| Cliente direto | `/scan` → "IR PARA CHECK-IN" |
| Check-in demo | `/demo?mesa=4` |
| Home cliente | `/demo/home?session=demo-session-XXX` |

### Dados mock disponíveis

- **Restaurante:** "Restaurante Demo" (slug: `demo`)
- **6 mesas:** 3 livres, 2 ocupadas, 1 reservada
- **3 categorias:** Entradas, Pratos Principais, Bebidas (incluindo itens alcoólicos)
- **2 pedidos:** 1 pendente, 1 em preparação
- **Clientes mock** para simulação do split de conta

---

## 16. Roadmap

Ver arquivo [ROADMAP.md](../ROADMAP.md) para o roadmap detalhado com status de cada feature.

**Resumo:**

| Fase | Prioridade | Principais items |
|------|-----------|-----------------|
| **Fase 1 — Lançamento** | 🔴 Alta | Stripe PIX real, onboarding de restaurante, fidelidade persistida |
| **Fase 2 — Crescimento** | 🟡 Média | Analytics, gestão de equipe, 2FA, WhatsApp Business |
| **Fase 3 — Escala** | 🔵 Baixa | Multi-unidades, NF-e, impressora de cozinha, API pública |

---

*Documento mantido pela equipe Qomanda. Para dúvidas: contato@qomanda.com.br*
