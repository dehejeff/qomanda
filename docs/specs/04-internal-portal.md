# Specs — Portal Interno Qomanda

Rotas: `/(internal)/internal/*`
Auth: Supabase Auth + validação de `staff_users` OU email na allowlist `KICOMANDA_STAFF_EMAILS`.
Verificação: `requireStaff()` em todas as rotas `/api/internal/*`.

Acesso exclusivo para equipe interna da Qomanda (suporte, financeiro, engenharia).

---

## Auth do Staff

**`src/lib/staff-auth.ts`**

- `requireStaff(request)`:
  1. Verifica `auth.getUser()` (Supabase Auth).
  2. Se autenticado, checa se email está em `staff_users.email` OU em `KICOMANDA_STAFF_EMAILS` (env var, lista separada por vírgula).
  3. Lança `401` se não autorizado.
- Nenhum restaurante pode acessar rotas `/internal/*` mesmo se autenticado.
- Staff não tem acesso a rotas `/dashboard/*` ou `/api/dashboard/*`.

---

## Página: `/internal` — Overview do Sistema

**Arquivo**: `src/app/(internal)/internal/page.tsx`

### Propósito
KPIs macro da plataforma em tempo real. Landing page do staff após login.

### Métricas principais
- Total de restaurantes ativos (plano ativo, sem churn).
- GMV (Gross Merchandise Volume) dos últimos 30 dias.
- Faturamento Qomanda (mensalidades pagas no mês corrente).
- Restaurantes em trial (< 14 dias de conta).
- Restaurantes inadimplentes (fatura vencida > 7 dias).
- Tickets de suporte abertos.

### Alertas
- `SystemHealthMonitor`: status dos serviços (Supabase, Asaas, Focus NFe, WhatsApp, Vercel crons).
- Cor: verde (ok), âmbar (degradado), vermelho (down).

### Gráficos
- GMV por dia (últimos 30 dias).
- Novos restaurantes por semana.
- Churn: restaurantes cancelados por mês.

---

## Página: `/internal/clients` — Lista de Clientes (Restaurantes)

**Arquivo**: `src/app/(internal)/internal/clients/page.tsx`

### Propósito
Listagem de todos os restaurantes cadastrados na plataforma. Busca e filtros avançados.

### Filtros
- Por plano (Starter / Growth / Pro / Enterprise).
- Por status de assinatura (ativo / trial / inadimplente / cancelado).
- Por gateway configurado (Asaas / MP / PIX manual / nenhum).
- Por data de cadastro.

### Colunas da lista
- Nome do restaurante + slug.
- Plano atual + mensalidade.
- Status da assinatura + próxima fatura.
- GMV (últimos 30 dias).
- Gateway ativo.
- Criado em.
- Último pedido.

### Ações rápidas
- Acessar perfil completo do restaurante.
- Abrir último ticket de suporte.

---

## Página: `/internal/clients/[id]` — Perfil do Restaurante

**Arquivo**: `src/app/(internal)/internal/clients/[id]/page.tsx`

### Propósito
Visão completa de um restaurante específico. Painel de diagnóstico e ações administrativas.

### Abas

**Visão Geral**
- Dados cadastrais: nome, slug, CNPJ, e-mail owner, modo operacional, data de cadastro.
- Plano + assinatura + status de pagamento.
- Métricas: total de mesas, total de pedidos, GMV total, ticket médio.

**Faturamento**
- `InternalBillingPanel`: histórico de faturas (`billing_invoices`) com status.
- Botão "Gerar fatura manual" → `POST /api/internal/billing/generate`.
- Botão "Marcar como paga" (fatura específica) → `POST /api/internal/billing/mark-paid`.
- Botão "Aplicar desconto" → `POST /api/internal/billing/discount`.
- Histórico de mudanças de plano.

**Gateway**
- Status do gateway configurado (Asaas / Mercado Pago / PIX manual).
- Se Asaas: status do subclient (`active` / `pending` / `error`).
- Botão "Revalidar conta Asaas" → `POST /api/internal/asaas/revalidate`.
- Log das últimas cobranças Asaas do restaurante.

**NF-e**
- Status de configuração (habilitada / desabilitada / erro).
- Última NF-e emitida.
- Log de erros de emissão.
- Credenciais Focus NFe configuradas (token mascarado).

**WhatsApp**
- Status do número configurado.
- Última mensagem enviada.
- Taxa de entrega (últimas 100 mensagens).
- `phone_number_id` + `waba_id` (mascarados).

**Saúde**
- Últimas sessões abertas.
- Pedidos por status (últimos 7 dias).
- Erros de webhook (últimos 50 eventos de `webhook_events` com status ≠ `processed`).

**Ações Administrativas**
- "Mudar plano" → `POST /api/internal/clients/[id]/change-plan`.
- "Estender trial por 7 dias" → `POST /api/internal/clients/[id]/extend-trial`.
- "Cancelar assinatura" → requer confirmação de texto ("CANCELAR").
- "Reativar assinatura" → `POST /api/internal/clients/[id]/reactivate`.
- "Provisionar cliente Asaas" (reparar clientes legados sem conta Asaas) → `ensureRestaurantBilling()`.

---

## Página: `/internal/billing` — Dashboard de Faturamento

**Arquivo**: `src/app/(internal)/internal/billing/page.tsx`

### Propósito
Visão consolidada do faturamento da plataforma.

### Métricas
- Mensalidades cobradas este mês vs mês anterior.
- Comissões acumuladas este mês.
- Total inadimplente.
- Taxa de conversão de trial → pago.

### Lista de faturas recentes
- Status: paga / pendente / vencida / cancelada.
- Filtro por mês + status.

### Ações em lote
- "Cobrar todos os vencidos" → `POST /api/internal/billing/charge-overdue`.
- "Exportar CSV de faturamento" → relatório mensal.

---

## Página: `/internal/support` — Fila de Suporte

**Arquivo**: `src/app/(internal)/internal/support/page.tsx`

### Propósito
Gerenciamento de todos os tickets de suporte de todos os restaurantes.

### Visualização
- Lista de tickets abertos, ordenados por prioridade e data.
- Filtros: por restaurante, por status, por prioridade, por categoria.
- Badge de quantidade por prioridade (urgente em vermelho).

### Detalhe do ticket (`/internal/support/[id]`)
- Thread completa de mensagens (`support_ticket_messages`).
- Responder como staff.
- Mudar status (aberto → em andamento → fechado).
- Mudar prioridade.
- Escalar para engenharia (cria issue interna).
- "Atribuir a" → assign para membro do staff.

### Componente `TicketUI`
Componente compartilhado entre `/dashboard/support/[id]` (restaurante vê) e `/internal/support/[id]` (staff vê). Renderiza a thread de mensagens de ambos os lados.

---

## Página: `/internal/health` — Monitor de Saúde

**Arquivo**: `src/app/(internal)/internal/health/page.tsx`

### Propósito
Painel de saúde operacional da plataforma.

### Checks
- **Supabase**: latência de queries, conexões ativas, erro rate.
- **Vercel Crons**: último run de cada cron + status (`success` / `failed` / `timeout`).
- **Asaas**: último webhook recebido + taxa de erro de cobranças.
- **Focus NFe**: última emissão + taxa de erro.
- **WhatsApp**: último envio + delivery rate.
- **`async_jobs`**: jobs pendentes + jobs travados (sem processar há > 10 min) + jobs com retry esgotado.

### Alertas
- Job travado: lista dos `async_jobs` com `status = 'pending'` e `created_at` > 10 min atrás.
- Botão "Reprocessar" para job travado específico.
- Botão "Limpar fila" (apenas jobs com `retry_count >= max_retries`).

---

## Página: `/internal/gateway` — Configuração de Gateway

**Arquivo**: `src/app/(internal)/internal/gateway/page.tsx`

### Propósito
Gerenciar as credenciais master de gateway da plataforma Qomanda (conta mãe Asaas, conta Mercado Pago, etc.).

### Conteúdo
- `platform_asaas_config`: status da conta master Asaas.
  - Saldo disponível na conta master.
  - API key (mascarada, botão "Editar" → modal com confirmação).
  - Status de webhooks registrados.
- Webhooks:
  - Lista de webhooks registrados na Asaas.
  - Último evento recebido.
  - Botão "Registrar/atualizar webhook" → `POST /api/internal/gateway/register-webhook`.

---

## Página: `/internal/playbook` — Playbook Operacional

**Arquivo**: `src/app/(internal)/internal/playbook/page.tsx`

### Propósito
Documentação interna de procedimentos. Acessível apenas ao staff.

### Conteúdo (markdown renderizado)
- Fluxo de onboarding de novo restaurante.
- Procedimento de cobrança manual.
- Diagnóstico de problemas comuns de gateway.
- Ações de recuperação de NF-e com erro.
- SLA de suporte por prioridade.
- Procedimento de cancelamento de conta.

---

## API Routes Internas

Todas em `/api/internal/*`. Todas verificam `requireStaff()`.

| Rota | Método | O que faz |
|------|--------|-----------|
| `/api/internal/stats` | GET | KPIs macro da plataforma |
| `/api/internal/clients` | GET | Lista paginada de restaurantes |
| `/api/internal/clients/[id]` | GET/PATCH | Detalhes e edição de restaurante |
| `/api/internal/clients/[id]/change-plan` | POST | Muda plano |
| `/api/internal/clients/[id]/extend-trial` | POST | Estende trial |
| `/api/internal/billing` | GET | Dashboard de faturamento |
| `/api/internal/billing/generate` | POST | Gera fatura manual |
| `/api/internal/billing/mark-paid` | POST | Marca fatura como paga |
| `/api/internal/billing/charge-overdue` | POST | Cobra todos vencidos |
| `/api/internal/asaas/revalidate` | POST | Revalida conta Asaas do restaurante |
| `/api/internal/gateway/register-webhook` | POST | Registra/atualiza webhook Asaas |
| `/api/internal/support/tickets` | GET | Lista tickets |
| `/api/internal/support/tickets/[id]` | GET/PATCH | Detalhe + update de ticket |
| `/api/internal/support/tickets/[id]/messages` | POST | Adiciona mensagem de staff |
| `/api/internal/health` | GET | Status de saúde dos serviços |
| `/api/internal/jobs/reprocess` | POST | Reprocessa job travado |
| `/api/internal/jobs/clear-failed` | POST | Remove jobs com retry esgotado |
| `/api/internal/nfe-service/[restaurantId]` | POST | Emite NF-e de serviço (fatura mensal) |
