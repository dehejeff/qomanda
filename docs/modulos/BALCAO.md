# Módulo: Balcão / fast food (`balcao`)

> Referência para go-live piloto (hamburgueria, poke, café, lanchonete).  
> Atualizado: 2026-05-31 · Preset: `src/lib/restaurant-models.ts`

---

## Definição

Operação **sem mesas físicas**. Cliente abre o link do balcão, faz check-in leve, pede pelo celular, recebe **número do pedido (#42)**, acompanha status até **“Pronto para retirar”** e paga (PIX manual, Asaas ou dinheiro) — idealmente **antes de retirar**, via aba Pagamento.

| Aspecto | Regra |
|---------|--------|
| Entrada do cliente | `/{slug}/balcao` (ou `/{slug}` redireciona automaticamente) |
| Modo operacional | `operational_mode = counter` |
| QR mesa | **Não usado** (sem mesas seed) |
| Sessão | 1 cliente por check-in · mesa virtual `BALCAO` |
| Recebimento | 100% na conta do restaurante |
| Comissão Qomanda | Só GMV digital · faturada dia 5 |
| Dinheiro | 0% comissão · confirmação garçom/caixa |

---

## Fluxo ponta a ponta

```
Dono cadastra (modelo Balcão)
  → preset: counter, PIX manual, 0 mesas seed
  → checklist: gateway + cardápio + link balcão

Cliente abre /slug/balcao (ou /slug → redirect)
  → check-in (nome + WhatsApp + PIN)
  → sessão counter (service_mode = counter)

Cliente
  → cardápio → pedido
  → sistema atribui pedido #N (seq por restaurante)
  → redireciona para /pedido (acompanhamento)

Operação
  → dashboard/garçom: fila com #N
  → avança status até "Pronto"
  → cliente vê "Pronto para retirar" no celular

Pagamento
  → aba Pagamento (checkout simplificado — sem "fechar mesa toda")
  → PIX manual | Asaas | dinheiro
  → garçom confirma manual / webhook Asaas
```

---

## Preset no cadastro

| Campo | Valor |
|-------|-------|
| `restaurant_model` | `balcao` |
| `operational_mode` | `counter` |
| `payment_gateway_provider` | `manual` |
| `marketplace_split_enabled` | `false` |
| Mesas seed | 0 |
| Mesa virtual | `BALCAO` (criada no 1º check-in) |
| Plano trial | Starter · 14 dias |

**Arquivos:** `src/app/cadastro/page.tsx`, `src/app/api/checkin/counter/route.ts`

---

## Checklist funcional

### Cliente (PWA)

| # | Capacidade | Status | Onde |
|---|------------|--------|------|
| 1 | Link `/balcao` como entrada principal | ✅ | `restaurant-models.ts`, onboarding |
| 2 | Redirect `/slug` → `/balcao` (só counter) | ✅ | `/[slug]/page.tsx` |
| 3 | Bloqueio `/balcao` em restaurante salão | ✅ | `/balcao/page.tsx` + API 403 |
| 4 | Check-in leve (sem QR mesa) | ✅ | `/api/checkin/counter` |
| 5 | Cardápio + carrinho | ✅ | `/[slug]/menu` |
| 6 | Pedido # sequencial por restaurante | ✅ | `counter_order_seq`, `/api/orders/counter-number` |
| 7 | Tela acompanhamento `/pedido` | ✅ | status + destaque "Pronto" |
| 8 | Realtime status pedido | ✅ | Supabase channel |
| 9 | Home mostra "Balcão" (não "Mesa BALCAO") | ✅ | `formatServiceLocationLabel` |
| 10 | Pagamento PIX manual | ✅ | checkout (mesmo motor salão) |
| 11 | Pagamento Asaas | ✅ | checkout |
| 12 | Dinheiro + confirmação | ✅ | checkout + garçom |
| 13 | Checkout sem "fechar mesa toda" | ✅ | `isCounterSession` no checkout |
| 14 | Login rápido cliente recorrente | ⚠️ | form básico; WhatsApp login 🔜 no balcão |

### Dono / manager (dashboard)

| # | Capacidade | Status | Onde |
|---|------------|--------|------|
| 1 | Fila pedidos kanban | ✅ | `/dashboard/orders` |
| 2 | Coluna Local mostra **#N** (não "BALCAO") | ✅ | `orderLocationLabel` |
| 3 | Gateway PIX manual / Asaas | ✅ | Settings → Pagamentos |
| 4 | Comissão preview | ✅ | billing panel |
| 5 | Checklist: link balcão **obrigatório** | ✅ | `restaurant-onboarding.ts` |
| 6 | Sem checklist QR mesas | ✅ | `needsTables` false para balcão |
| 7 | Link rápido "Abrir balcão" no onboarding | ✅ | `primaryLinks` |

### Garçom / caixa

| # | Capacidade | Status | Onde |
|---|------------|--------|------|
| 1 | Fila com **#N** do pedido | ✅ | `/garcom/pedidos` |
| 2 | Avançar status até entregue | ✅ | `/garcom/pedidos` |
| 3 | Confirmar PIX/dinheiro | ✅ | `/garcom/pagamentos` |
| 4 | Alerta pagamentos pendentes | ✅ | badge + banner |

### Comercial

| # | Capacidade | Status |
|---|------------|--------|
| 1 | 100% conta restaurante | ✅ |
| 2 | Comissão só digital | ✅ |
| 3 | Dinheiro 0% | ✅ |
| 4 | Fatura dia 5 automática | ✅ | cron + aba Mensalidade |

---

## Migrações necessárias (balcão)

Mesmas do salão — campos de balcão estão em `migrate-commercial-restaurant-account.sql`:

- `restaurants.counter_order_seq`
- `sessions.service_mode` (`dine_in` | `counter`)
- `orders.display_number`, `orders.order_channel` (`table` | `counter`)

Ordem completa: [`ESTEIRA.md`](../ESTEIRA.md) · **não precisa** de `migrate-table-checkin-token.sql` para operar só balcão.

---

## Smoke test E2E (balcão)

| Passo | Ação | Esperado |
|-------|------|----------|
| 1 | Cadastro modelo **Balcão / fast food** | `operational_mode=counter`, 0 mesas |
| 2 | PIX manual configurado | Cliente vê chave no pagamento |
| 3 | Cardápio publicado | ≥ 1 item |
| 4 | Abrir `/{slug}/balcao` | Form check-in |
| 5 | `/{slug}` sem QR | Redirect para `/balcao` |
| 6 | Check-in → pedido | Recebe **#1** na tela `/pedido` |
| 7 | Dashboard/garçom avança → Pronto | Cliente vê verde "Pronto para retirar" |
| 8 | Pagamento PIX manual | Pendente → garçom confirma |
| 9 | Segundo pedido mesmo dia | **#2** (seq incrementa) |
| 10 | Dinheiro | `commission_exempt=true` |

---

## Diferenças vs Salão (`salao`)

| | Salão | Balcão |
|---|--------|--------|
| Entrada | QR mesa + token | Link `/balcao` |
| Sessão | Compartilhada na mesa | 1:1 por check-in |
| Pedido | Sem número público | `#N` display |
| Checkout | Split mesa + fechar mesa toda | Só pagar pedido |
| Acompanhamento | Home + pedidos mesa | `/pedido` + status pronto |
| Mesas seed | 10 | 0 |
| Migração QR token | Obrigatória | Opcional |

---

## Fora de escopo (balcão v1)

- Reset diário do contador `#N` (seq é contínua por restaurante)
- Pagamento **obrigatório antes** de enviar pedido (hoje: pedido → pagar → retirar)
- KDS / impressão cozinha
- Login WhatsApp rápido na tela `/balcao` (existe no salão via `/[slug]`)
- Push notification nativa "pedido pronto"
- Feature flags runtime em `features[]`

---

## Arquivos-chave

| Área | Path |
|------|------|
| Preset | `src/lib/restaurant-models.ts` |
| Check-in | `src/app/api/checkin/counter/route.ts` |
| Entrada cliente | `src/app/(customer)/[slug]/balcao/page.tsx` |
| Número pedido | `src/lib/counter-orders.ts`, `/api/orders/counter-number` |
| Acompanhamento | `src/app/(customer)/[slug]/pedido/page.tsx` |
| Menu + envio | `src/app/(customer)/[slug]/menu/page.tsx` |
| Pagamento | `src/app/(customer)/[slug]/checkout/page.tsx` |
| Fila dono | `src/app/(dashboard)/dashboard/orders/page.tsx` |
| Garçom | `src/app/garcom/` |
| Confirmar pagamento | `/api/dashboard/payments/confirm` |

---

## Decisões explícitas (balcão)

- ✅ Link `/balcao` é a porta de entrada — não QR mesa
- ✅ Cada check-in = nova sessão (fila rápida, sem split entre clientes)
- ✅ Mesa virtual `BALCAO` só para modelagem interna (sessões/pedidos)
- ✅ Mesmo motor de pagamento do salão, UX simplificada no checkout
- ❌ Balcão em restaurante `dine_in` puro — bloqueado
