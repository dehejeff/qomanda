# Módulo: Food hall / praça (`food_hall`)

> Praça de alimentação, shopping, mercado gastronômico — **runtime idêntico ao balcão**, posicionamento e onboarding específicos.  
> Atualizado: 2026-05-31 · Preset: `src/lib/restaurant-models.ts`

**Base técnica:** [`BALCAO.md`](BALCAO.md) — leia primeiro; este doc cobre só o que muda.

---

## Definição

Operação **100% counter** (sem mesas físicas). Um operador (ou praça) usa **um cardápio unificado** com categorias por cozinha/estação. Cliente pede pelo link, recebe **#N**, retira quando **“Pronto”**.

| Aspecto | Regra |
|---------|--------|
| Modo operacional | `operational_mode = counter` |
| Entrada | `/{slug}/balcao` (redirect automático de `/{slug}`) |
| Mesas | 0 seed · mesa virtual `BALCAO` |
| Cardápio | **Unificado** — organize por categorias (estações) |
| v2 futuro | Comanda única multi-estação, multi-unidade |

---

## Fluxo ponta a ponta

```
Dono cadastra (Food hall / praça)
  → preset: counter, PIX manual, 0 mesas
  → cardápio com categorias por cozinha (ex.: Japonês, Burger, Sobremesa)

Cliente
  → /balcao (título "Praça de alimentação")
  → check-in → cardápio → pedido #N
  → /pedido até "Pronto para retirar"
  → pagamento PIX / Asaas / dinheiro

Operação
  → mesma fila kanban e painel garçom do balcão
  → confirmação PIX manual + dinheiro
```

> **v1 = fluxo balcão.** Não exige multi-loja nem comanda única entre operadores.

---

## Preset no cadastro

| Campo | Valor |
|-------|-------|
| `restaurant_model` | `food_hall` |
| `operational_mode` | `counter` |
| `primaryEntry` | `balcao` |
| Mesas seed | 0 |
| Features (doc) | `cardapio_unificado` |

---

## Checklist funcional

### Igual ao Balcão (`balcao`) ✅

Tudo em [`BALCAO.md`](BALCAO.md) se aplica:

- Link `/balcao`, redirect `/slug`
- Pedido # sequencial
- Tela `/pedido` + realtime
- Checkout simplificado (sem fechar mesa)
- Garçom + pagamentos pendentes
- Comissão digital / dinheiro 0%

### Específico Food hall

| # | Capacidade | Status | Onde |
|---|------------|--------|------|
| 1 | UI "Praça de alimentação" no `/balcao` | ✅ | `balcao/page.tsx` (`restaurant_model`) |
| 2 | Cardápio unificado (categorias = estações) | ✅ | `/dashboard/menu` — operador organiza |
| 3 | Cadastro disponível no `/cadastro` | ✅ | `restaurant-models.ts` |
| 4 | Landing descreve praça/shopping | ✅ | `page.tsx` |
| 5 | Comanda única multi-estação | 🔜 | Fase 5 / v2 |
| 6 | Multi-unidade (vários operadores) | 🔜 | Fase 5 |

---

## Onboarding

| Item | Obrigatório |
|------|-------------|
| Gateway PIX / Asaas | ✅ |
| Cardápio (≥1 item; ideal: categorias por estação) | ✅ |
| Link balcão testado | ✅ |
| QR mesas | ❌ não aplica |
| Convidar garçom | opcional |

---

## Migrações necessárias

Mesmas do **balcão** (sem QR token):

1. `migrate-internal-portal.sql`
2. `migrate-commercial-restaurant-account.sql`
3. `migrate-restaurant-manual-payment.sql`
4. `migrate-restaurant-model.sql`

**Não precisa** `migrate-table-checkin-token.sql` para operar só food hall.

---

## Smoke test E2E

Igual [`BALCAO.md`](BALCAO.md) — smoke test balcão, com extras:

| Passo | Esperado |
|-------|----------|
| Cadastro modelo **Food hall / praça** | `operational_mode=counter` |
| Cardápio com 2+ categorias (estações) | Visível no app |
| `/balcao` | Título **Praça de alimentação** |
| Pedido → **#1** → pronto → PIX | Fluxo completo |

---

## Food hall vs Balcão fast food

| | Balcão (`balcao`) | Food hall (`food_hall`) |
|---|-------------------|-------------------------|
| Runtime | counter | **Igual** counter |
| Mesas | 0 | 0 |
| Entrada | `/balcao` | `/balcao` |
| Posicionamento | Lanchonete, café | Shopping, praça |
| Cardápio | Simples | **Categorias = cozinhas** |
| UI entrada | "Pedido no balcão" | "Praça de alimentação" |
| v2 | — | Comanda única multi-estação |

---

## Fora de escopo (v1)

- Vários `restaurant_id` linked (multi-operador na praça)
- Split de pagamento entre operadores
- Comanda RFID / única comanda física
- Reset diário do contador #N

---

## Arquivos-chave

| Área | Path |
|------|------|
| Preset | `src/lib/restaurant-models.ts` |
| UI praça | `src/app/(customer)/[slug]/balcao/page.tsx` |
| Fluxo completo | [`BALCAO.md`](BALCAO.md) |
| Categorias cardápio | `/dashboard/menu` |

---

## Decisões explícitas

- ✅ **v1 = balcão** — mesma stack, preset e APIs
- ✅ Diferença é **comercial + organização do cardápio**, não código paralelo
- 🔜 v2 comanda única — só quando houver demanda de praça real
