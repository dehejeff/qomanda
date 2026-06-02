# Módulo: Salão com mesas (`salao`)

> Referência para go-live piloto (ex.: Tasca do Porto).  
> Atualizado: 2026-05-31 · Preset: `src/lib/restaurant-models.ts`

---

## Definição

Restaurante **à la carte** com mesas físicas. Cliente entra **somente pelo QR da mesa**, faz pedidos pelo celular, divide a conta e paga na mesa (PIX manual, Asaas ou dinheiro). Garçom opera fila de pedidos e confirma pagamentos manuais.

| Aspecto | Regra |
|---------|--------|
| Entrada do cliente | QR `/{slug}?mesa={n}&t={token}` |
| Modo operacional | `operational_mode = dine_in` |
| Balcão | **Bloqueado** (API + UI) |
| Recebimento | 100% na conta do restaurante |
| Comissão Qomanda | Só GMV digital · faturada dia 5 |
| Dinheiro | 0% comissão · confirmação manual |

---

## Fluxo ponta a ponta

```
Dono cadastra (modelo Salão)
  → preset: dine_in, PIX manual, 10 mesas seed
  → checklist: gateway + cardápio + QR mesas

Cliente escaneia QR da mesa
  → verify token (anti-fraude)
  → check-in (WhatsApp + PIN 4 dígitos)
  → entra na sessão da mesa (ou junta sessão aberta)

Cliente
  → cardápio → pedido → acompanha status (home + pedidos)
  → checkout: só minha parte | fechar mesa toda
  → split igual/custom · opcional álcool separado
  → PIX manual | Asaas | dinheiro

Restaurante
  → cozinha: fila kanban (dashboard)
  → garçom: avança pedidos + confirma PIX/dinheiro
  → dono: mapa mesas, modal mesa, confirmar pagamento

Pagamento confirmado
  → comissão registrada (digital) ou isenta (cash)
  → close request sincronizado
  → mesa quitada → sessão fecha → mesa livre
```

---

## Preset no cadastro

| Campo | Valor |
|-------|-------|
| `restaurant_model` | `salao` |
| `operational_mode` | `dine_in` |
| `payment_gateway_provider` | `manual` |
| `marketplace_split_enabled` | `false` |
| Mesas seed | 10 (numeradas 1–10) |
| Plano trial | Starter · 14 dias |

**Arquivos:** `src/app/cadastro/page.tsx`, `src/app/api/auth/provision-trial/route.ts`, `seedDefaultTablesForModel()`

---

## Checklist funcional

### Cliente (PWA)

| # | Capacidade | Status | Onde |
|---|------------|--------|------|
| 1 | QR mesa com token único | ✅ | `migrate-table-checkin-token.sql`, `/api/checkin/verify` |
| 2 | Check-in nome + WhatsApp + PIN | ✅ | `/api/checkin`, `/[slug]?mesa=&t=` |
| 3 | Join sessão existente na mesa | ✅ | `checkin/route.ts` |
| 4 | Home: só pedidos do cliente logado | ✅ | `/[slug]/home` |
| 5 | Cardápio + carrinho + observações | ✅ | `/[slug]/menu` |
| 6 | Pedidos: abas Meus / Mesa toda | ✅ | `/[slug]/orders` |
| 7 | Cancelar pedido pendente | ✅ | `/api/orders/cancel` |
| 8 | Cancelados fora do total (mesa toda) | ✅ | `orders/page.tsx` |
| 9 | Checkout individual | ✅ | `/[slug]/checkout` |
| 10 | Fechar mesa toda (split igual/custom) | ✅ | `close_requests` + checkout |
| 11 | Split álcool / alimentação | ✅ | `alcohol-split.ts` |
| 12 | PIX manual (chave restaurante) | ✅ | checkout + `manual-pix` API |
| 13 | Asaas (conta restaurante) | ✅ | `payment-gateway-resolve.ts` |
| 14 | Dinheiro (valor informado) | ✅ | checkout `cash_pending` |
| 15 | Confirmação + código + mesa quitada | ✅ | `confirm-payment.ts` |
| 16 | Fidelidade pós-pagamento | ✅ | `grant-loyalty-offers.ts` |

### Dono / manager (dashboard)

| # | Capacidade | Status | Onde |
|---|------------|--------|------|
| 1 | Mapa de mesas interativo (Overview) | ✅ | `overview-floor-map.tsx` |
| 2 | QR download/impressão por mesa | ✅ | `table-qr-modal.tsx` |
| 3 | Modal mesa: pedidos, trocar mesa, encerrar | ✅ | `table-manage-modal.tsx` |
| 4 | Confirmar PIX/dinheiro na mesa | ✅ | `pending-cash-payments-panel.tsx` |
| 5 | Fila pedidos kanban | ✅ | `/dashboard/orders` |
| 6 | Pedidos por mesa | ✅ | `/dashboard/orders/table/[id]` |
| 7 | Gateway PIX manual / Asaas | ✅ | `restaurant-gateway-panel.tsx` |
| 8 | Comissão + faixas (preview mês) | ✅ | `restaurant-billing-panel.tsx` |
| 9 | Checklist onboarding | ✅ | `restaurant-onboarding-panel.tsx` |
| 10 | Convidar garçom | ✅ | Settings → Equipe |
| 11 | Modo operação travado em salão | ✅ | preset + Settings (editável) |

### Garçom

| # | Capacidade | Status | Onde |
|---|------------|--------|------|
| 1 | Login `/login?perfil=garcom` | ✅ | `restaurant-auth.ts` |
| 2 | Fila pedidos (avançar status) | ✅ | `/dashboard/waiter` |
| 3 | Ver mesas (ocupada/livre) | ✅ | `/dashboard/waiter/tables` |
| 4 | Confirmar PIX manual + dinheiro | ✅ | `/dashboard/waiter/payments` |
| 5 | Alerta pagamentos pendentes | ✅ | banner na fila de pedidos |
| 6 | Push / som notificação | 🔜 | Fase 3 opcional |

### Comercial / modelo

| # | Capacidade | Status | Onde |
|---|------------|--------|------|
| 1 | Comissão progressiva GMV digital | ✅ | `commission-tiers.ts` |
| 2 | Cash = 0% comissão | ✅ | `isCommissionExemptMethod` |
| 3 | Snapshot comissão por pagamento | ✅ | `payment-commission.ts` |
| 4 | Fatura mensal dia 5 (manual) | ⚠️ | registro existe · cobrança auto 🔜 |
| 5 | Limite mesas por plano (20 Starter) | ⚠️ | plano define `max_tables` · enforce 🔜 |

---

## Migrações necessárias (salão)

Rodar **antes** do piloto:

1. `migrate-internal-portal.sql`
2. `migrate-commercial-restaurant-account.sql`
3. `migrate-restaurant-manual-payment.sql`
4. `migrate-restaurant-model.sql`
5. **`migrate-table-checkin-token.sql`** — sem isso QR mesa retorna 503

---

## Smoke test E2E (salão)

| Passo | Ação | Esperado |
|-------|------|----------|
| 1 | Cadastro modelo **Salão com mesas** | `operational_mode=dine_in`, 10 mesas |
| 2 | Settings → PIX manual | Checklist gateway ✅ |
| 3 | 1+ item no cardápio | Checklist menu ✅ |
| 4 | Imprimir QR mesa 1 | URL com `mesa=1&t=uuid` |
| 5 | Celular: scan → check-in | Home mesa 1 |
| 6 | Pedido 2 itens | Status na fila dashboard |
| 7 | Garçom avança → pronto | Cliente vê status |
| 8 | Checkout PIX manual | Pendente no painel |
| 9 | Garçom confirma | Cliente vê confirmado |
| 10 | Repetir dinheiro | `commission_exempt=true` |
| 11 | Mesa quitada | Mesa livre no mapa |

---

## Fora de escopo (salão v1)

Não bloqueiam piloto — registrados no roadmap:

- Botão **Chamar garçom** no app cliente
- Push notification nativa para garçom
- NF-e automática pós-pagamento
- Cobrança automática fatura dia 5
- Rodízio / taxa fixa por pessoa
- Enforcement hard de `max_tables` do plano
- `features[]` do preset como feature flags runtime (hoje é documentação; fluxo existe no código)

---

## Arquivos-chave

| Área | Path |
|------|------|
| Preset | `src/lib/restaurant-models.ts` |
| Check-in | `src/app/api/checkin/route.ts`, `verify/route.ts` |
| Cliente | `src/app/(customer)/[slug]/` |
| Checkout | `src/app/(customer)/[slug]/checkout/page.tsx` |
| Confirmar pagamento | `src/lib/confirm-payment.ts`, `/api/dashboard/payments/confirm` |
| Mesas dono | `src/components/dashboard/table-manage-modal.tsx` |
| Garçom | `src/app/(dashboard)/dashboard/waiter/` |
| Comissão | `src/lib/commission-tiers.ts`, `commission-billing.ts` |
| Onboarding | `src/lib/restaurant-onboarding.ts` |

---

## Decisões explícitas (salão)

- ✅ Entrada **apenas** QR mesa — `/slug/balcao` retorna erro se `dine_in`
- ✅ Pagamento na conta do restaurante — sem split na hora
- ✅ Garçom confirma manual; Asaas confirma via webhook
- ❌ Marketplace split — não usar como padrão
