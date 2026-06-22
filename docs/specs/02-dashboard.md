# Specs — Dashboard do Restaurante

Rotas: `/(dashboard)/dashboard/*`
Auth: Supabase Auth (email + senha). Layout server-side verifica `auth.getUser()`, redireciona para `/login` se não autenticado.

---

## Roles e acesso

| Role | Quem | Acesso |
|------|------|--------|
| `owner` | Dono do restaurante | Todo o dashboard |
| `manager` | Gerente (via `restaurant_members`) | Dashboard completo exceto Settings avançados |
| `waiter` / `garçom` | Garçom | Apenas `/garcom/*` |
| `kitchen` / `cozinha` | Cozinheiro | Apenas `/cozinha` |
| `caixa` | Caixa | Apenas `/dashboard/caixa` |
| `recepcionista` | Recepcionista | Apenas `/garcom/fila` |

Roles verificados server-side via `requireRestaurantAccess(['owner', 'manager', ...])` em cada API route.

---

## Página: `/dashboard` — Overview

**Arquivo**: `src/app/(dashboard)/dashboard/page.tsx`
**Componente principal**: `OverviewLiveDashboard`

### Propósito
Visão em tempo real do restaurante. Adapta-se ao modo operacional (dine_in / counter / both).

### Modos

**Dine-in / both**: exibe mapa de mesas (`OverviewFloorMap`)
- Mesas coloridas por status: verde (livre), laranja (ocupada), azul (reservada).
- Clique na mesa → sheet com detalhes da sessão, total consumido, ações (abrir comanda, chamar).
- Drag & drop para reposicionar mesas no mapa (posição salva).

**Counter**: exibe painel de balcão (`OverviewCounterPanel`)
- Lista de pedidos de balcão por número (em andamento + prontos).
- Ações: avançar status do pedido.

### KPIs ao vivo (topo)
- Mesas ocupadas / total.
- Pedidos em aberto (pending + confirmed + preparing).
- Faturamento do dia (pagamentos `paid` com `paid_at` hoje).
- Ticket médio do dia.

### Painel de pedidos recentes (`OverviewOrdersPanel`)
- Últimos pedidos com status, mesa, valor. Link para `/dashboard/orders`.

### Notificações
- `DashboardNotificationBell`: sino com badge no header. Exibe chamadas de garçom + alertas de fidelidade.
- Som ao receber nova notificação.

### Realtime
- `useRestaurantRealtime()` hook: subscriptions nas tabelas `orders`, `sessions`, `tables`, `restaurant_notifications`.
- Polling fallback a cada 15s se Realtime desconectar.

### Onboarding checklist
- `RestaurantOnboardingPanel`: exibido enquanto checklist não está 100% completo.
- Itens: criar cardápio, criar mesa, configurar gateway, configurar WhatsApp, etc.

---

## Página: `/dashboard/orders` — Kanban de Pedidos

**Arquivo**: `src/app/(dashboard)/dashboard/orders/page.tsx`

### Propósito
Gestão de todos os pedidos em aberto. Layout kanban com colunas por status.

### Colunas do kanban
```
Aguardando → Confirmado → Preparando → Pronto → Entregue
(pending)    (confirmed)  (preparing)  (ready)  (delivered)
```

### Cards de pedido
- Mesa N / Balcão #N / Cliente.
- Itens com nome e quantidade.
- Botão para avançar status (→ próxima coluna).
- Botão cancelar (apenas `pending`).
- Tempo desde criação (ex: "há 5 min").
- Badge "CASH" se tem pagamento cash pendente.

### Ações
- **Avançar status**: PATCH `/api/dashboard/kitchen/order-status`.
- **Cancelar**: POST `/api/dashboard/orders/cancel`.
- **Confirmar pagamento cash/PIX manual**: via `PendingCashPaymentsPanel` (drawer lateral).

### Busca global
- `DashboardSearchContext` permite buscar por mesa, cliente, item de cardápio.
- Resultado filtra cards em tempo real.

### Realtime
- Novos pedidos aparecem na coluna "Aguardando" instantaneamente.
- Atualização de status reflete cross-dispositivo (garçom + dono + cozinha).

---

## Página: `/dashboard/orders/[id]` — Detalhe do Pedido

Visualização detalhada de um pedido específico: itens, notas, histórico de status, cliente.

---

## Página: `/dashboard/orders/table/[tableId]` — Pedidos por Mesa

Todos os pedidos ativos de uma mesa específica. Link a partir do floor map ou da grid de mesas.

---

## Página: `/dashboard/orders/customer/[customerId]` — Pedidos por Cliente

Pedidos de um cliente específico na sessão atual.

---

## Página: `/dashboard/menu` — Gestão do Cardápio

**Arquivo**: `src/app/(dashboard)/dashboard/menu/page.tsx`

### Propósito
CRUD completo de categorias e itens do cardápio.

### Categorias
- Listagem em cards com drag & drop para reordenar (`display_order`).
- Criar / renomear / excluir categorias.
- Ao excluir: apenas se não tiver itens.

### Items de cardápio
- Listagem por categoria (accordion expansível).
- **Criar/editar** via modal `MenuItemModal`:
  - Nome, descrição, preço base.
  - Preço promocional (opcional — exibe badge "Promoção" e preço tachado no cardápio).
  - Foto: upload de arquivo → `POST /api/dashboard/menu-image` (Supabase Storage) ou URL externa.
  - Toggle "Disponível" (indisponível: exibe no cardápio mas não pode ser pedido).
  - Toggle "Chef's Pick" (destaque no topo do cardápio).
  - Toggle "Contém álcool" (flag para split food/alcohol no checkout).
  - Toggle "Couvert" (`couvert_kind`: regular | artístico | none).
- Excluir item (soft-delete: `available = false` se tem histórico de pedidos).

---

## Página: `/dashboard/tables` — Mesas e QR Codes

**Arquivo**: `src/app/(dashboard)/dashboard/tables/page.tsx`

### Propósito
Criação e gestão de mesas, geração de QR Codes, mapa de seções.

### Grid de mesas
- Card por mesa: número, status (livre / ocupada / reservada), capacidade, seções (features).
- Status colorido: verde (free), laranja (occupied), azul (reserved).
- Botões: QR Code, Editar, Arquivar.

### QR Code (`TableQrModal`)
- Exibe QR Code da mesa com logo sobreposta.
- Download PNG (botão "Baixar").
- URL: `/{slug}?mesa=N&t=TOKEN`.

### Criação de mesa (`TableCreateModal`)
- Número (auto-sugerido como próximo sequencial).
- Capacidade (opcional — usado para filtro na fila de espera).
- Seções (multi-select de `table_features`).

### Edição de mesa (`TableManageModal`)
- Editar número, capacidade, seções.
- Arquivar mesa (soft-delete; mantém histórico de sessões).

### Seções / Features
- CRUD de `table_features` (nome + emoji).
- Cada mesa pode pertencer a N seções.
- Seções são as opções na fila de espera do cliente.
- Mesas sem seção: aparecem como "Sem seção" no mapa e como "Qualquer seção" na fila do cliente.

### Waitlist Modal
- Abre `WaitlistModal` para adicionar grupo na fila a partir da tela de mesas.

### Group Reserve Modal
- `GroupReserveModal`: reservar múltiplas mesas para um grupo grande.
- Cria entrada em `table_waitlist` com `feature_id = null` + `table_waitlist_allocations`.
- Mesas ficam com `status = 'reserved'`.

### Plano e limite de mesas
- `plan_limits.ts`: bloqueia criação se número de mesas ativas > limite do plano.
- Exibe badge de upgrade se próximo do limite.

---

## Página: `/dashboard/fila` — Fila de Espera

**Arquivo**: `src/app/(dashboard)/dashboard/fila/page.tsx`

Usa o componente `WaitlistManager` completo.

### Conteúdo
- Abas por seção (table_features + "Qualquer seção" se houver mesas não atribuídas).
- Por seção:
  - Mesas livres (com número e capacidade).
  - Grupos na fila (nome, tamanho, tempo de espera, WhatsApp).
- Ações:
  - "Chamar próximo": `POST /api/dashboard/waitlist` `{ action: 'callNext', featureId, tableId }`.
  - "Sentar" (grupo notificado chegou): `action: 'seat'`.
  - "No-show" (não compareceu): `action: 'noShow'` → expira a entrada.
  - "Cancelar" (remove da fila): `action: 'cancel'`.
  - "Adicionar walk-in": `action: 'addWalkIn'` → adiciona grupo diretamente (sem passar pelo app do cliente).

---

## Página: `/dashboard/reports` — Relatórios

**Arquivo**: `src/app/(dashboard)/dashboard/reports/page.tsx`

### Propósito
Analytics do restaurante com filtros por período.

### Períodos disponíveis
- Hoje, Últimos 7 dias, Este mês, Mês passado, Últimos 30 dias, Últimos 90 dias, Personalizado.

### Seções de análise

**Faturamento**
- Total de receita no período.
- Gráfico de barras por dia.
- Comparação com período anterior.

**Top itens do cardápio**
- Ranking de itens mais pedidos por quantidade e por receita.

**Horários de pico**
- Heatmap de pedidos por dia da semana + hora do dia.

**Métodos de pagamento**
- Distribuição percentual: PIX / Crédito / Débito / Dinheiro / PIX manual / Ofertas.

**Ticket médio**
- Ticket médio por sessão de mesa.
- Ticket médio por cliente.

**Exportação**
- Botão "Exportar CSV" → `GET /api/dashboard/reports/export?format=csv`.
- Botão "Exportar HTML" → relatório imprimível.

---

## Página: `/dashboard/customers` — Clientes

**Arquivo**: `src/app/(dashboard)/dashboard/customers/page.tsx`

### Propósito
Lista de clientes que visitaram o restaurante. Busca por nome ou WhatsApp.

### Conteúdo por cliente
- Nome, WhatsApp mascarado.
- Número de visitas.
- Última visita.
- Total gasto no restaurante.
- Botão para criar oferta personalizada de fidelidade (`CustomerOfferModal`).

---

## Página: `/dashboard/caixa` — Caixa

**Arquivo**: `src/app/(dashboard)/dashboard/caixa/page.tsx`

### Propósito
Painel para o operador de caixa confirmar pagamentos em dinheiro e PIX manual.

### Fluxo
1. Cliente paga em dinheiro/PIX manual no checkout → payment criado com `status = 'pending'`.
2. Garçom/caixa busca pelo `confirmation_code` (6 chars) ou pelo número da mesa.
3. Confirma o pagamento → POST `/api/dashboard/payments/confirm`.
4. Payment muda para `status = 'paid'` → enfileira NF-e + WhatsApp receipt.

### Conteúdo
- Lista de pagamentos pendentes (cash + PIX manual) ordenados por mesa/hora.
- Input de busca por código de confirmação.
- Card por pagamento: mesa, cliente, valor, método, código.
- Botão "Confirmar pagamento".

---

## Página: `/dashboard/settings` — Configurações

**Arquivo**: `src/app/(dashboard)/dashboard/settings/page.tsx`

9 abas de configuração:

### Aba 1: Perfil do Restaurante
- Nome, slug (readonly após criação), endereço, telefone, e-mail de contato.
- Upload de logo.
- Modo operacional (dine_in / counter / both).
- Dados legais: CNPJ/CPF, Razão Social, tipo de empresa.
- `PATCH /api/dashboard/profile`.

### Aba 2: Pagamentos (Gateway)
**`RestaurantGatewayPanel`** — configurar como receber pagamentos digitais:

| Opção | Descrição |
|-------|-----------|
| PIX manual | Apenas chave PIX — cliente faz transferência e garçom confirma |
| Asaas | Integração completa. PIX automático + cartão. Requer onboarding Asaas (CNPJ + dados bancários) |
| Mercado Pago | PIX + cartão. Requer conta MP + OAuth connect |

- Toggle "Aceitar dinheiro" (sempre disponível).
- Configurações do PIX manual: chave, tipo (CPF / CNPJ / Celular / E-mail / Aleatória), nome do titular.

### Aba 3: Mensalidade (Billing)
**`RestaurantBillingPanel`**:
- Plano atual + mensalidade + comissão %.
- Próxima fatura + valor estimado.
- Botão "Fazer upgrade" → `PlanUpgradeModal`.
- Histórico de faturas com status (paga / pendente / vencida).
- Histórico de mudança de plano.

### Aba 4: Notas Fiscais (NF-e)
**`RestaurantNfePanel`**:
- Habilitar/desabilitar emissão de NF-e.
- Configurações Focus NFe: token, CNPJ emissor, ambiente (homologação/produção).
- Tipo de nota: NFC-e (consumo físico) ou NFS-e (serviço/delivery).
- Regime tributário, CNAE, série da nota.
- Opção: dividir nota em Alimentos + Bebidas (para restaurantes com split food/alcohol).
- Envio por WhatsApp: habilitar envio automático da nota após emissão.

### Aba 5: Fidelidade
- Criar/editar regras de fidelidade (`loyalty_rules`).
- Tipos: por número de visitas ou por valor gasto.
- Benefícios: item grátis, bebida grátis, desconto %, benefício customizado.
- Quando cliente atinge o threshold: `grant-loyalty-offers.ts` cria oferta em `customer_offers`.
- Garçom vê alerta em `/garcom/beneficios`.

### Aba 6: Couvert
- Habilitar/desabilitar couvert artístico (por show/espetáculo) ou couvert regular.
- Configurar janela de horário do couvert artístico.
- Valor do couvert.
- `POST /api/dashboard/couvert`.

### Aba 7: WhatsApp
- Configurar credenciais WhatsApp Business API (Meta Cloud API).
- `phone_number_id`, `access_token`, `waba_id`.
- Botão "Testar": envia mensagem para número do próprio restaurante.
- Status: conectado / não configurado / erro.
- Obs: painel de staff no portal interno vê status mas não edita credenciais (restaurante é dono delas).

### Aba 8: Segurança
- Alterar senha do owner.
- Ver sessões ativas (dispositivos logados).

### Aba 9: Equipe
**`RestaurantTeamPanel`**:
- Listar membros da equipe (`restaurant_members`).
- Convidar novo membro: nome + e-mail + role (garçom / cozinha / caixa / recepcionista).
- Remove membro (revoga acesso).
- `GET/POST /api/dashboard/members`.

---

## Página: `/dashboard/support` — Suporte

**Arquivo**: `src/app/(dashboard)/dashboard/support/page.tsx`

### Propósito
Abertura e acompanhamento de tickets de suporte do restaurante com a Qomanda.

### Lista de tickets
- Status: aberto / em andamento / fechado.
- Prioridade: baixa / média / alta / urgente.
- Categoria: técnico / financeiro / NF-e / outro.
- Data de abertura + última resposta.

### Criar ticket
- Assunto, categoria, prioridade, descrição.
- Anexos (upload de arquivos).
- `POST /api/dashboard/support/tickets`.

### Detalhe do ticket (`/dashboard/support/[id]`)
- Thread de mensagens (usando `TicketUI` component compartilhado).
- Responder (adiciona mensagem).
- Ver status atual.

---

## Página: `/login` — Login do Restaurante

**Arquivo**: `src/app/(dashboard)/login/page.tsx`

- Formulário email + senha.
- Supabase Auth `signInWithPassword`.
- Esqueci minha senha → Supabase magic link.
- Redirect para `/dashboard` após login.
- Link para `/cadastro` (novo restaurante).

---

## Componentes do Dashboard

### Sidebar (`src/components/dashboard/sidebar.tsx`)
Navegação lateral principal. Adapta itens ao modo operacional:

- Visão Geral
- Pedidos
- Cardápio
- Mesas (apenas dine_in / both)
- Fila de Espera (apenas se `hasWaitlist`)
- Caixa
- Relatórios
- Clientes
- Suporte
- Configurações

### Header (`src/components/dashboard/header.tsx`)
- Busca global de pedidos.
- Sino de notificações (`DashboardNotificationBell`).
- Avatar / logout.

### PendingCashPaymentsPanel
- Drawer lateral que aparece quando há pagamentos em dinheiro/PIX manual pendentes.
- Atalho rápido para confirmar sem ir para `/dashboard/caixa`.
