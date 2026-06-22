# Specs — App do Garçom e Cozinha

Rotas: `/(dashboard)/garcom/*` e `/(dashboard)/cozinha`
Auth: Supabase Auth. Roles: `waiter`/`recepcionista` → garcom; `kitchen` → cozinha.
Acesso verificado server-side. Garçom não acessa `/dashboard/*` exceto `/dashboard/caixa`.

---

## App do Garçom

Superfície otimizada para uso no celular do garçom durante o serviço. Layout mobile-first com fundo escuro.

---

## Página: `/garcom` — Home do Garçom

**Arquivo**: `src/app/(dashboard)/garcom/page.tsx`

### Propósito
Dashboard simplificado do garçom. Mostra alertas prioritários e ações rápidas.

### Conteúdo
- **Chamadas de garçom pendentes** (from `restaurant_notifications` onde `type = 'waiter_call'`):
  - Mesa N — há X minutos. Botão "Atender" (marca notificação como lida).
  - Ordenadas por hora (mais antigas primeiro).

- **Benefícios de fidelidade não entregues** (`WaiterBenefitsAlert`):
  - Clientes na sessão ativa com oferta de fidelidade resgatável.
  - Exibe: "Mesa X — Cliente Y tem direito a [benefício]".
  - Botão "Entregar" → marca oferta como `redeemed`.

- **Pedidos prontos** (`orders` com `status = 'ready'`):
  - Mesa N — itens prontos para entregar.
  - Botão "Entregue" → avança para `status = 'delivered'`.

- **Resumo de mesas** (se `dine_in` / `both`):
  - Grade de mesas com status: verde (livre), laranja (ocupada).
  - Toque na mesa → detalhes da sessão.

### Realtime
- Supabase Realtime em `restaurant_notifications` e `orders`.
- Som para nova chamada de garçom.

---

## Página: `/garcom/mesas` — Mesas (Garçom)

**Arquivo**: `src/app/(dashboard)/garcom/mesas/page.tsx`

Grid de mesas do restaurante no ponto de vista do garçom. Não tem drag-and-drop (somente o dono tem acesso ao layout do mapa).

### Ações por mesa
- Ver pedidos ativos da mesa (link para `/garcom/mesa/[tableId]`).
- Abrir nova comanda (link para mesa).
- Status visual: livre / ocupada / reservada.

---

## Página: `/garcom/mesa/[tableId]` — Detalhe da Mesa

**Arquivo**: `src/app/(dashboard)/garcom/mesa/[tableId]/page.tsx`

### Conteúdo
- Sessão ativa: horário de abertura, participantes.
- Lista de pedidos da mesa por status.
- Total consumido.
- Ações:
  - "Avançar pedido" (confirmed → preparing → ready → delivered).
  - "Novo pedido" → link para adicionar pedido via garçom (se o restaurante habilitar).
  - "Ver conta" → detalhes de billing.

---

## Página: `/garcom/pedidos` — Todos os Pedidos

**Arquivo**: `src/app/(dashboard)/garcom/pedidos/page.tsx`

Lista simplificada de pedidos em aberto, análoga ao kanban do dashboard mas em formato lista (mais adequado para celular).

### Filtros
- Por status: Aguardando / Preparando / Pronto.
- Por mesa.

### Ações rápidas
- Avançar status.
- Cancelar (apenas `pending`).

---

## Página: `/garcom/fila` — Gestão de Fila (Garçom)

**Arquivo**: `src/app/(dashboard)/garcom/fila/page.tsx`

Acesso à `WaitlistManager` simplificado. Disponível para roles `waiter` e `recepcionista`.

### Funcionalidades
- Ver grupos na fila por seção.
- Chamar próximo.
- Sentar / no-show / cancelar.
- Adicionar walk-in.

Mesma lógica do `/dashboard/fila`, mas em layout mobile otimizado.

---

## Página: `/garcom/beneficios` — Benefícios de Fidelidade

**Arquivo**: `src/app/(dashboard)/garcom/beneficios/page.tsx`

Lista de clientes nas sessões ativas com ofertas de fidelidade pendentes de entrega.

### Conteúdo por item
- Mesa N — Nome do cliente.
- Benefício: ex. "1 cerveja grátis".
- Validade da oferta.
- Botão "Marcar como entregue" → `PATCH /api/dashboard/offers/[id]/redeem`.

---

## Tela de Cozinha: `/cozinha` — Display de Cozinha (KDS)

**Arquivo**: `src/app/(dashboard)/cozinha/page.tsx`

### Propósito
Kitchen Display System (KDS). Exibido em monitor ou tablet na cozinha. Sem navegação — tela única.

### Layout
- Fundo escuro, tipografia grande.
- Cards de pedidos em duas ou três colunas.
- Auto-scroll se muitos pedidos.

### Colunas de status exibidas
```
Aguardando → Confirmado → Preparando
(pending)    (confirmed)  (preparing)
```
Pedidos `ready` / `delivered` são removidos automaticamente após 30 segundos.

### Card de pedido
- **Número/mesa**: "Mesa 5" ou "Balcão #42".
- **Tempo**: contagem crescente desde criação. Fica vermelho após 15 min.
- **Itens**: lista com quantidade e nome. Negrito para itens especiais.
- **Notas**: texto livre do cliente em destaque (cor âmbar).
- **Ações**:
  - "Confirmar" (pending → confirmed).
  - "Preparando" (confirmed → preparing).
  - "Pronto" (preparing → ready).

### Realtime
- Supabase Realtime em `orders` — sem polling, atualização instantânea.
- Toque de som ao novo pedido.

### Filtros (opcional)
- Por categoria de cardápio (ex: "Bebidas" vs "Pratos").
- Configurável por restaurante.

---

## Componentes Compartilhados (Garçom + Dashboard)

### `WaitlistManager` (`src/components/waiter/waitlist-manager.tsx`)
Componente fullstack de gestão de fila. Usado tanto em `/dashboard/fila` quanto em `/garcom/fila`.

- Props: `restaurantId`, `features`, `mode` (dashboard | waiter).
- Abas por seção + "Qualquer seção".
- Lista mesas livres + grupos na fila.
- Botões de ação (callNext, seat, noShow, cancel, addWalkIn).
- Realtime via hook `useWaitlistRealtime()`.

### `OrderStatusBadge` (`src/components/shared/order-status-badge.tsx`)
Badge colorido com ícone por status de pedido. Usado em garçom, dashboard e cozinha.

| Status | Cor | Ícone |
|--------|-----|-------|
| pending | âmbar | clock |
| confirmed | azul | check |
| preparing | laranja | flame |
| ready | verde | bell |
| delivered | cinza | package |
| cancelled | vermelho | x |
