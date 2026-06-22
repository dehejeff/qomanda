# Specs — Superfície do Cliente (PWA)

Rotas: `/(customer)/[slug]/*` + `/hub/*` + `/scan`

O cliente nunca instala um app. Tudo roda no browser (PWA). Identidade salva em `localStorage`. Sem Supabase Auth — autenticação customizada via WhatsApp + PIN.

---

## Fluxo principal (dine-in)

```
QR mesa → /{slug}?mesa=N&t=TOKEN
  → check-in (novo ou retornante)
    → /{slug}/home   (hub da sessão)
    → /{slug}/menu   (cardápio + carrinho)
    → /{slug}/orders (acompanhar pedidos)
    → /{slug}/checkout (fechar conta e pagar)
    → /{slug}/receipts (recibos)
```

---

## Página: `/{slug}` — Check-in na Mesa

**Arquivo**: `src/app/(customer)/[slug]/page.tsx`

### Propósito
Ponto de entrada após o cliente escanear o QR Code da mesa. Verifica o token, identifica o cliente e cria a sessão.

### Pré-condição
URL contém `?mesa=N&t=TOKEN` (gerado pelo QR da mesa). Se não tiver os parâmetros, exibe tela pedindo para escanear o QR.

### Verificação do QR (`GET /api/checkin/verify`)
- Valida que o token pertence à mesa e ao restaurante.
- Retorna `tableStatus` (free / occupied / reserved).
- Se inválido: exibe mensagem de erro e botão "Escanear QR da mesa".

### Modos de acesso

**Quick check-in** (cliente já cadastrado neste aparelho):
- Detecta `kicomanda_customer_id` no localStorage.
- Exibe nome do cliente + botão "Entrar na Mesa N".
- POST `/api/checkin` com `{ customerId }`.

**Primeiro acesso** (novo cliente):
- Formulário: Nome, Sobrenome, WhatsApp (obrigatório), CPF ou Passaporte (opcional), PIN 4 dígitos + confirmação.
- PIN é salvo no banco como hash; usado em logins futuros.
- POST `/api/checkin` com todos os campos.

**Cliente retornante** (tem conta mas em aparelho diferente):
- Input de WhatsApp → `POST /api/customer/login` → challenge PIN.
- Verifica PIN → `POST /api/customer/login/verify-pin` → retorna customerId + sessão ativa.

### Casos especiais
- **Restaurante modo `counter`** sem mesa: redireciona para `/{slug}/balcao`.
- **Restaurante modo `both`**: exibe botões "Escanear QR da mesa" + "Pedir no balcão".
- **Sessão ativa neste restaurante**: exibe botão "Continuar na mesa X" para skip do check-in.
- **`hasWaitlist`**: exibe link "Entrar na fila" se restaurante tem seções de mesa.

### Pós-check-in
- Salva no localStorage: `kicomanda_session_id`, `kicomanda_customer_id`, `kicomanda_customer_name`.
- Chama `navigateToCustomerHome(slug, sessionId)` → redireciona para `/{slug}/home?session=X`.

### Segurança
- Todo o check-in é server-side (`createAdminClient()`). O browser nunca tem acesso direto à tabela `customers`.
- Token do QR é de uso múltiplo mas expirado quando a mesa tem sessão ativa e outro cliente tenta entrar.

---

## Página: `/{slug}/balcao` — Check-in no Balcão

**Arquivo**: `src/app/(customer)/[slug]/balcao/page.tsx`

### Propósito
Versão simplificada do check-in para restaurantes modo `counter`. Não exige QR de mesa; cliente recebe número de pedido.

### Diferenças vs check-in na mesa
- Sem verificação de token/mesa.
- Atribui número de pedido sequencial (ex: "#42").
- Após check-in: vai para `/{slug}/pedido` (tracking de pedido no balcão) em vez de `/{slug}/home`.

---

## Página: `/{slug}/home` — Hub da Sessão

**Arquivo**: `src/app/(customer)/[slug]/home/page.tsx`

### Propósito
Tela principal da sessão ativa. Centraliza ações e mostra status em tempo real.

### Conteúdo
- **Card de status**: status do pedido mais recente (Aguardando / Confirmado / Preparando / Pronto / Entregue) com barra de progresso animada.
- **Ações rápidas**: botões para Cardápio, Meus Pedidos, Fechar Conta, Chamar Garçom.
- **Chamar Garçom**: POST `/api/customer/call-waiter` — throttle de 90 segundos por sessão. Cria notificação em `restaurant_notifications` → alerta no app do garçom.
- **Banner de split**: se existe `close_request` pendente (outro participante iniciou divisão de conta), exibe convite para participar.
- **Couvert**: botão para habilitar/desabilitar couvert da sessão (`POST /api/customer/couvert`).
- **Realtime**: Supabase Realtime nas tabelas `orders`, `sessions`, `payments`, `close_request_participants` para atualizar sem reload.

---

## Página: `/{slug}/menu` — Cardápio Digital

**Arquivo**: `src/app/(customer)/[slug]/menu/page.tsx`

### Propósito
Cardápio interativo com categorias, items, carrinho e envio de pedido.

### Layout
- **Header fixo**: nome do restaurante + ícone do carrinho (badge com quantidade).
- **Abas de categorias**: tabs horizontais rolantes. Clique faz scroll suave até a seção.
- **Chef's Pick hero**: item com `chef_pick = true` exibido em destaque no topo.
- **Item cards**: foto, nome, descrição, preço (tachado se promo), badge de promoção.
- **Preço efetivo**: `menuItemEffectivePrice()` retorna preço promocional se ativo, senão preço base.
- **Floating cart bar**: exibido quando carrinho tem itens. Mostra total + botão "Ver pedido".

### Ações
- **Adicionar ao carrinho**: stepper +/- por item; item pode ter nota livre.
- **Ver detalhe** (modal `MenuItemDetailModal`): foto grande, descrição, nota, stepper.
- **Enviar pedido**: POST `/api/orders` com itens + notas. Limpa carrinho. Toast de confirmação.

### Regras de negócio
- Item com `available = false` é exibido mas não pode ser adicionado.
- Item com `contains_alcohol = true` é marcado (relevante para split food/alcohol no checkout).
- Pedido enviado cria registro em `orders` + `order_items` com `unit_price` no momento do pedido.

---

## Página: `/{slug}/cardapio` — Cardápio Público

**Arquivo**: `src/app/(customer)/[slug]/cardapio/page.tsx`

### Propósito
Versão pública do cardápio, sem sessão ativa. Acessível via QR Code de entrada do restaurante (gerado no dashboard). Apenas visualização — sem carrinho.

### Diferenças vs `/menu`
- Não requer sessão ou autenticação.
- Sem carrinho/pedido.
- Header com pill "Escaneie a mesa para pedir" (link para `/scan`).
- CTA principal: "Entrar na fila de espera" (se `hasWaitlist`), senão "Escanear QR da mesa".

---

## Página: `/{slug}/orders` — Meus Pedidos

**Arquivo**: `src/app/(customer)/[slug]/orders/page.tsx`

### Propósito
Acompanhar pedidos da sessão atual, ver total consumido, dividir conta.

### Abas
- **Minha Conta**: pedidos feitos pelo cliente logado. Total consumido por ele (sem taxa de serviço ou com, dependendo de configuração).
- **Mesa Toda**: todos os pedidos da sessão, agrupados por participante.

### Cards de pedido
- Status com cor e ícone: Aguardando (âmbar) / Confirmado (azul) / Preparando (laranja) / Pronto (verde) / Entregue (cinza) / Cancelado (vermelho).
- Itens com nome, quantidade, preço unitário.
- Botão "Cancelar" (apenas pedidos `pending`).

### Billing summary
- `buildSessionBilling()` / `buildCustomerBilling()` calcula:
  - Subtotal dos itens.
  - Taxa de serviço (se configurada).
  - Total pago já (via `payments` com status `paid`).
  - Saldo em aberto.
- Mostra badge "Quitado" se saldo ≤ R$0,02.

### Ação principal
- Botão "Fechar conta" → `/{slug}/checkout?session=X`.

### Realtime
- Polling a cada 8s + Supabase Realtime para atualizações de status de pedido.

---

## Página: `/{slug}/checkout` — Pagamento

**Arquivo**: `src/app/(customer)/[slug]/checkout/page.tsx`

### Propósito
Tela de pagamento. Suporta múltiplos métodos, split de conta, divisão food/alcohol.

### Modos de fechamento
- **Individual**: paga apenas o consumo próprio.
- **Mesa toda**: paga o total da mesa (somente se nenhuma divisão está em andamento).

### Split de conta (`close_request`)
- Iniciado por qualquer participante. Demais recebem convite na `/home`.
- `computeSplitGate()` verifica: todos aceitaram? há pagamento duplicado? retorna `canProceed` ou `blocking reason`.
- Divisão igual ou personalizada por valor.

### Métodos de pagamento disponíveis
Determinados por `getPublicPaymentConfig()` do restaurante:

| Método | Descrição |
|--------|-----------|
| `pix` | PIX via Asaas (QR Code gerado on-the-fly) |
| `credit` | Cartão de crédito via Asaas ou Mercado Pago |
| `debit` | Cartão de débito |
| `cash` | Dinheiro (exige confirmação manual pelo caixa/garçom) |
| `manual_pix` | PIX manual via chave do restaurante (exige confirmação) |
| `offer` | Oferta de fidelidade (desconto aplicado como "pagamento") |

### Fluxo PIX (Asaas)
1. POST `/api/asaas/payments` → cria cobrança → retorna `pixQrCode` base64.
2. Exibe QR Code para o cliente pagar.
3. Asaas chama webhook → `/api/asaas/webhook` → confirma pagamento.
4. Cliente faz polling e vê "Pagamento confirmado!".

### Fluxo PIX manual
1. Exibe chave PIX do restaurante + valor sugerido.
2. Cliente paga externamente.
3. POST `/api/payments/manual-pix` → cria payment `pending`.
4. Garçom/caixa confirma no dashboard.

### Fluxo dinheiro
1. POST `/api/payments/cash` → cria payment `pending` com `confirmation_code`.
2. Garçom/caixa confirma no painel do caixa usando o código.

### Split food/alcohol
- `splitConsumptionByAlcohol()`: calcula quanto do total é alimento vs álcool.
- Cria dois pagamentos separados (para reembolso empresarial separado).

### Ofertas de fidelidade
- `isOfferRedeemable()`: verifica se oferta está ativa e não vencida.
- `computeOfferDiscount()`: calcula valor do desconto.
- Desconto registrado como `payment` com `method = 'offer'`.
- Ofertas excluídas do cálculo de comissão Qomanda.

### Pós-pagamento
- Navega para `/{slug}/receipts?session=X`.
- `async_jobs` criados: `nfe_emit` + `whatsapp_send` (recibo).

---

## Página: `/{slug}/receipts` — Recibos

**Arquivo**: `src/app/(customer)/[slug]/receipts/page.tsx`

### Propósito
Lista de pagamentos realizados na sessão atual com detalhes de valor, método, código de confirmação.

### Conteúdo
- Total pago na sessão.
- Card por pagamento: método, valor, código de confirmação (6 chars), data.
- Botão "Enviar por WhatsApp" (abre link `wa.me` com mensagem pré-formatada de recibo).

---

## Página: `/{slug}/profile` — Perfil do Cliente

**Arquivo**: `src/app/(customer)/[slug]/profile/page.tsx`

### Propósito
Perfil do cliente dentro do contexto da sessão. Exibe dados, visitas e fidelidade.

### Conteúdo
- Nome + WhatsApp mascarado.
- Contador de visitas neste restaurante.
- Barra de progresso de fidelidade (próxima recompensa em X visitas).
- Botão "Editar nome" (PATCH `/api/customer/profile`).
- Link para o Hub (área cross-restaurante).
- Botão "Sair desta mesa" (`POST /api/customer/leave-table`).

---

## Página: `/{slug}/fila` — Fila de Espera

**Arquivo**: `src/app/(customer)/[slug]/fila/page.tsx`

### Propósito
Permite que o cliente entre na fila de espera por uma mesa com características específicas (ex: "Vista mar", "Área interna") antes de fazer check-in.

### Fluxo
1. Carrega seções disponíveis (tabela `table_features` + mesas atribuídas).
2. Inclui "Qualquer seção" se há mesas sem seção atribuída (`feature_id IS NULL`).
3. Cliente escolhe seção + informa nome + WhatsApp (+ pessoa secundária opcional) + tamanho do grupo.
4. POST `/api/customer/waitlist` → cria entrada na `table_waitlist`.
5. ID salvo no localStorage. Polling a cada 5 segundos para verificar status.

### Estados da entrada
- **waiting**: na fila. Exibe posição ("Você é o 3º da fila").
- **notified**: mesa liberada. Contador regressivo (tolerância configurada pelo restaurante, padrão 10 min). Tom sonoro (`playReadyChime()`). Botão para escanear QR da mesa.
- **seated / expired / cancelled**: entrada concluída.

### Lógica de "Qualquer seção"
- Detecta mesas sem `table_feature_map`.
- Entra na fila com `featureId = null`.
- Quando mesa livre sem seção é detectada, `callNextForAnySection()` notifica o próximo.

---

## Página: `/{slug}/pedido` — Tracking de Pedido Balcão

**Arquivo**: `src/app/(customer)/[slug]/pedido/page.tsx`

### Propósito
Versão simplificada de tracking para clientes do balcão (modo counter). Mostra número do pedido e status.

### Conteúdo
- Número do pedido (ex: "#42").
- Status em tempo real.
- Polling ou Realtime.

---

## Hub do Cliente (`/hub`)

O Hub é uma área cross-restaurante. Requer autenticação por senha de 6 dígitos (diferente do PIN de 4 dígitos da mesa).

### Autenticação do Hub (`POST /api/customer/hub/access`)
- Pede WhatsApp + senha de 6 dígitos (configurada no primeiro acesso ao hub).
- Retorna session token (TTL: 24h / idle: 15 min). Armazenado em sessionStorage.
- `HubSessionGate` component bloqueia qualquer rota `/hub/*` sem token válido.

### `/hub` — Home do Hub

**Arquivo**: `src/app/hub/page.tsx`

- Lista de restaurantes visitados (pelo `customer_visits`).
- Sessão ativa (se houver): link direto para `/{slug}/home`.
- Resumo de pagamentos recentes.
- Atalho para perfil e recibos.

### `/hub/profile` — Perfil Global

- Editar nome, WhatsApp.
- Gerenciar cartões salvos.
- Alterar senha de 6 dígitos.

### `/hub/receipts` — Todos os Recibos

- Lista de pagamentos em todos os restaurantes.
- Filtro por restaurante.

### `/hub/receipts/[slug]` — Recibos por Restaurante

- Recibos filtrados por restaurante específico.

---

## Componente: Bottom Navigation (`CustomerBottomNav`)

**Arquivo**: `src/components/customer/bottom-nav.tsx`

Presente nas páginas `home`, `menu`, `orders`, `checkout`, `profile`. 5 abas:

| Aba | Ícone | Rota |
|-----|-------|------|
| Início | home | `/{slug}/home` |
| Cardápio | menu_book | `/{slug}/menu` |
| Pedidos | receipt_long | `/{slug}/orders` |
| Pagamento | payments | `/{slug}/checkout` |
| Perfil | person | `/{slug}/profile` |

---

## Scanner QR (`/scan`)

**Arquivo**: `src/app/scan/page.tsx`

- Usa `html5-qrcode` para acessar câmera do dispositivo.
- Lê QR Code de mesa → extrai `slug`, `mesa`, `token`.
- Redireciona para `/{slug}?mesa=N&t=TOKEN`.
- Fallback: input manual.
- Stash local: `stashPendingTableCheckIn()` salva QR em localStorage para caso o redirect seja interrompido.

---

## Navegação de Volta (Back Button)

Todas as páginas com botão de voltar usam `popNav()` de `src/lib/nav-history.ts`:

- O `CustomerLayout` (`'use client'`) rastreia mudanças de `pathname` e empilha a URL anterior em `sessionStorage`.
- `popNav()` retira o topo da pilha; se vazia, usa o fallback hardcoded.
- `consumeGoingBack()` impede que navegação de "voltar" gere nova entrada na pilha (evita loop).

Fallbacks por página:
- `orders` → `/{slug}` (home)
- `checkout` → `/{slug}/orders`
- `receipts` → `/{slug}/orders`
- `profile` → `/{slug}` (home)
