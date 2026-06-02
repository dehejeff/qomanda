# Módulo: Salão + balcão (`salao_balcao`)

> Bar, restaurante com mesas **e** fila no balcão — dois fluxos no mesmo cardápio.  
> Atualizado: 2026-05-31 · Preset: `src/lib/restaurant-models.ts`

**Compõe:** [`SALAO.md`](SALAO.md) + [`BALCAO.md`](BALCAO.md) no mesmo estabelecimento.

---

## Definição

Operação **híbrida**. Clientes no salão usam QR da mesa (check-in, split, checkout mesa). Clientes na fila do balcão usam link `/balcao` (pedido #, retirada). **Um cardápio, um gateway, uma fila de cozinha.**

| Aspecto | Regra |
|---------|--------|
| Modo operacional | `operational_mode = both` |
| Entrada salão | QR `/{slug}?mesa={n}&t={token}` |
| Entrada balcão | `/{slug}/balcao` |
| Hub sem QR | `/{slug}` → escolhe mesa **ou** balcão |
| Mesas seed | 8 numeradas |
| Gateway | Único por restaurante (PIX manual / Asaas) |

---

## Fluxo ponta a ponta

```
Dono cadastra (Salão + balcão)
  → preset: both, PIX manual, 8 mesas
  → checklist: gateway + cardápio + QR mesas + link balcão

─── Fluxo SALÃO (ver SALAO.md) ───
QR mesa → check-in → pedidos → checkout mesa → garçom confirma

─── Fluxo BALCÃO (ver BALCAO.md) ───
/balcao → check-in → pedido #N → /pedido → pagamento → retirada

─── Operação unificada ───
Dashboard / garçom: mesas + pedidos #N na mesma fila
Cozinha: kanban com Local = "Mesa 3" ou "#42"
```

---

## Preset no cadastro

| Campo | Valor |
|-------|-------|
| `restaurant_model` | `salao_balcao` |
| `operational_mode` | `both` |
| `payment_gateway_provider` | `manual` |
| Mesas seed | 8 |
| `primaryEntry` | `both` |

---

## Checklist funcional

### Entrada do cliente

| # | Capacidade | Status | Onde |
|---|------------|--------|------|
| 1 | Hub `/{slug}`: QR mesa **ou** balcão | ✅ | `/[slug]/page.tsx` |
| 2 | QR mesa + token (salão) | ✅ | `checkin/route.ts` |
| 3 | Link `/balcao` (counter) | ✅ | `checkin/counter/route.ts` |
| 4 | Balcão bloqueado se virar só `dine_in` | ✅ | Settings + API |
| 5 | Redirect `/slug` → `/balcao` só se `counter` puro | ✅ | não aplica a `both` |

### Salão (mesas)

| # | Capacidade | Status | Ref |
|---|------------|--------|-----|
| 1–16 | Fluxo completo salão | ✅ | [`SALAO.md`](SALAO.md) |

### Balcão (fila)

| # | Capacidade | Status | Ref |
|---|------------|--------|-----|
| 1–14 | Fluxo completo balcão | ✅ | [`BALCAO.md`](BALCAO.md) |

### Dono / onboarding

| # | Capacidade | Status | Onde |
|---|------------|--------|------|
| 1 | Checklist mesas QR **obrigatório** | ✅ | onboarding |
| 2 | Checklist link balcão **obrigatório** | ✅ | onboarding (both) |
| 3 | Links rápidos: Mesas + Balcão | ✅ | `primaryLinks` |
| 4 | Mapa mesas + pedidos #N no kanban | ✅ | orders page |
| 5 | Modo operação editável (Settings) | ✅ | gateway panel |

### Garçom

| # | Capacidade | Status |
|---|------------|--------|
| 1 | Fila mista: "Mesa" vs `#N` | ✅ |
| 2 | Confirmar PIX/dinheiro (ambos fluxos) | ✅ |

---

## Migrações necessárias

Todas do salão **+** campos de balcão (mesmo arquivo comercial):

1. `migrate-internal-portal.sql`
2. `migrate-commercial-restaurant-account.sql` ← `counter_order_seq`, `service_mode`, `display_number`
3. `migrate-restaurant-manual-payment.sql`
4. `migrate-restaurant-model.sql`
5. **`migrate-table-checkin-token.sql`** ← obrigatório para QR mesa

---

## Smoke test E2E (híbrido)

| # | Trilha | Passos-chave |
|---|--------|--------------|
| A | **Salão** | QR mesa 1 → pedido → checkout PIX → garçom confirma → mesa livre |
| B | **Balcão** | `/balcao` → pedido → **#1** → pronto → dinheiro → garçom confirma |
| C | **Hub** | Abrir `/{slug}` sem QR → ver botões mesa + balcão |
| D | **Painel** | Kanban mostra Mesa 1 e #1 na mesma lista |

---

## Fora de escopo (v1)

- Dois cardápios separados (salão vs balcão) — hoje é **um cardápio**
- Dois gateways diferentes por fluxo
- KDS separado por canal
- Taxa de serviço diferente balcão vs mesa

---

## Arquivos-chave

| Área | Path |
|------|------|
| Preset | `src/lib/restaurant-models.ts` |
| Hub cliente | `src/app/(customer)/[slug]/page.tsx` |
| Salão | [`SALAO.md`](SALAO.md) |
| Balcão | [`BALCAO.md`](BALCAO.md) |
| Onboarding | `src/lib/restaurant-onboarding.ts` |
| Fila unificada | `src/app/(dashboard)/dashboard/orders/page.tsx` |

---

## Decisões explícitas

- ✅ **Um restaurante, dois fluxos** — `operational_mode = both`
- ✅ Mesmo cardápio e gateway para salão e balcão
- ✅ Sessões isoladas: mesa compartilhada vs balcão 1:1
- ✅ Hub na raiz quando cliente não escaneou QR ainda
