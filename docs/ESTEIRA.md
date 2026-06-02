# Qomanda — Esteira de reconstrução

> Documento mestre: alinha o que conversamos, o estado do código e a ordem de execução.  
> Atualizado: 2026-05-30

---

## Visão em uma frase

**Um restaurante escolhe o modelo operacional no cadastro → o sistema aplica preset (~90%) → só falta gateway + cardápio para ir à rua.**

Modelo comercial: pagamento cai **100% na conta do restaurante**; Qomanda fatura mensalidade + comissão progressiva (dia 5).

---

## Mapa de modelos operacionais

| Modelo | ID | Status | Cliente entra por | Pagamento | Painel principal |
|--------|-----|--------|-------------------|-----------|------------------|
| **Salão com mesas** | `salao` | ✅ Disponível | QR da mesa | Checkout na mesa · PIX manual / Asaas / dinheiro | Mapa de mesas + garçom |
| **Balcão / fast food** | `balcao` | ✅ Disponível | Link `/balcao` | Pedido # · PIX manual | Fila + número |
| **Salão + balcão** | `salao_balcao` | ✅ Disponível | Mesa ou balcão | Ambos fluxos | Mesas + balcão |
| **Food hall / praça** | `food_hall` | ✅ Disponível | Link balcão | Pedido # · PIX manual | Fila + número (fluxo balcão) |
| Rodízio / taxa fixa | `rodizio` | 🔜 Fase 3 | QR mesa | Taxa/pessoa + bebidas | — |
| Buffet por peso | `buffet_peso` | 🔜 Fase 4 | Balcão/caixa | R$/kg | — |

Definição técnica (preset): `src/lib/restaurant-models.ts`  
**Especificação por módulo:** [`SALAO.md`](modulos/SALAO.md) · [`BALCAO.md`](modulos/BALCAO.md) · [`SALAO_BALCAO.md`](modulos/SALAO_BALCAO.md) · [`FOOD_HALL.md`](modulos/FOOD_HALL.md)

---

## O que cada preset configura automaticamente

Ao escolher o modelo no **cadastro** (`/cadastro`):

| Campo / ação | Salão | Balcão | Salão+balcão |
|--------------|-------|--------|--------------|
| `operational_mode` | `dine_in` | `counter` | `both` |
| `payment_gateway_provider` | `manual` (PIX direto) | `manual` | `manual` |
| `marketplace_split_enabled` | `false` | `false` | `false` |
| Mesas seed | 10 mesas | — | 8 mesas |
| Plano trial | Starter 14 dias | Starter 14 dias | Starter 14 dias |
| Fluxo cliente | check-in mesa → cardápio → checkout | balcão → pedido # → pronto | ambos |

**O dono ainda precisa (checklist no dashboard):**

1. **Gateway** — chave PIX manual *ou* API key Asaas (`Settings → Pagamentos`)
2. **Cardápio** — pelo menos 1 item
3. **Mesas** — QR impresso (salão) ou link do balcão testado

Progresso visível em: **Dashboard → Overview → “Primeiros passos”**

---

## Próximas etapas de produto (prioridade)

| P | Entrega | Fase |
|---|---------|------|
| **Agora** | Rodar migrações pendentes + smoke garçom (`/garcom`) | 2 |
| **P0** | App garçom mobile (`/garcom`) — pedidos, pagamentos, mesas, benefícios, fechar mesa | 2 ✅ |
| **P0** | Garçom confirma PIX manual + dinheiro | 2–3 ✅ |
| **P0** | Aba Mensalidade no dashboard (histórico + fatura aberta) | 2 ✅ |
| **P0** | Cobrança automática mensalidade (cron dia 5) | 2 ✅ |
| **P1** | Modelo no portal interno + deploy | 2 |
| **P1** | Site/landing com modelos e comissão mensal | 2 ✅ |
| **P2** | Fatura automática dia 5 | 3 |
| **P2** | **Mercado Pago** (1º gateway pós-Asaas) | 3 · Q4 2026 |
| **P3** | **PagBank** | 3 · Q1 2027 |
| **P3** | **Stone**, **Cielo**, Getnet (sob demanda) | 4 · 2027 |
| **P3** | Rodízio, buffet peso · food hall v2 (multi-estação) | 3–5 |

---

### Fase 0 — Fundação comercial ✅ (feito)

- [x] Recebimento direto na conta do restaurante (sem split na hora; comissão mensal)
- [x] Planos 199 / 299 / 499 + comissão progressiva
- [x] Gateway restaurante (Asaas conta dele)
- [x] PIX manual (sem Asaas)
- [x] Dinheiro com confirmação manual (0% comissão)
- [x] Fatura mensal `restaurant_monthly_invoices`

**Migrações:** `migrate-commercial-restaurant-account.sql`, `migrate-restaurant-manual-payment.sql`, `migrate-internal-portal.sql`

---

### Fase 1 — Modelo no cadastro ✅ (esta entrega)

- [x] `restaurant_model` + presets (`migrate-restaurant-model.sql`)
- [x] Cadastro em 3 passos: Conta → **Modelo** → Estabelecimento
- [x] Seed de mesas conforme modelo (`provision-trial`)
- [x] Checklist de onboarding no dashboard
- [x] Lib central `restaurant-models.ts`

**Próximo passo imediato:** rodar migrações em prod + testar cadastro piloto (Tasca do Porto).

---

### Fase 2 — Go-live piloto (sexta / primeiro cliente)

Objetivo: restaurante operando com **PIX manual + dinheiro + balcão OU salão**.

| # | Tarefa | Responsável | Critério de pronto |
|---|--------|-------------|-------------------|
| 2.1 | Rodar todas migrações pendentes no Supabase | Dev | Sem erro SQL |
| 2.2 | Cadastro com modelo correto (ex.: `salao_balcao`) | Restaurante | Checklist > 75% |
| 2.3 | PIX manual configurado | Restaurante | Cliente vê chave no checkout |
| 2.4 | Cardápio mínimo (10–20 itens) | Restaurante | Pedido teste OK |
| 2.5 | QR mesas OU link balcão | Restaurante | Check-in end-to-end |
| 2.6 | Garçom convidado (se salão) | Restaurante | Login `/login?perfil=garcom` → `/garcom` |
| 2.7 | Simular pagamento PIX + dinheiro | Você + garçom | Confirmação em `/garcom/pagamentos` |
| 2.8 | Garçom avança pedido + fecha mesa (se salão) | Garçom | `/garcom/pedidos` + `/garcom/mesas` |
| 2.9 | Fechar 1ª venda real | Comercial | R$ 1.990 implantação |

**Não bloquear go-live:** Asaas produção, NF-e real Focus, portal interno completo, Mercado Pago.

---

### Fase 3 — Salão maduro

- [x] App garçom mobile (`/garcom`) — pedidos, pagamentos, mesas, benefícios, fechar mesa
- [x] Garçom confirma PIX manual + dinheiro (`/garcom/pagamentos`)
- [x] Alerta de pagamento pendente na fila de pedidos do garçom
- [x] Benefícios de fidelidade visíveis ao garçom (`/garcom/beneficios`)
- [x] Aba Mensalidade no dashboard (histórico + link fatura)
- [x] Cobrança automática fatura dia 5 (cron + PIX Asaas master)
- [ ] Push / som para pagamento pendente (opcional)
- [ ] Rodízio (`rodizio`) — taxa fixa por pessoa no check-in
- [ ] Relatório comissão mensal exportável (restaurante + interno)
- [ ] NF-e de serviço emitida junto com fatura mensal

### Fase 4 — Balcão & self-service

- [ ] Buffet por peso (`buffet_peso`)
- [ ] Impressão cozinha / KDS
- [ ] **Stone** e **Cielo** — gateways e-commerce (ver esteira de gateways)
- [ ] Pagamento antes vs depois (config por modelo)

---

### Fase 5 — Escala

- [ ] Food hall — multi-unidade / comanda única avançada (v2)
- [ ] Multi-unidade
- [ ] NF-e serviço Qomanda → restaurante (B2B)
- [ ] App nativo garçom (opcional)

---

## Fluxos por modelo (referência rápida)

### Salão (`salao`)

```
Cliente escaneia QR mesa
  → check-in (WhatsApp + PIN)
  → cardápio → pedido → cozinha
  → checkout (PIX manual | Asaas | dinheiro)
  → garçom confirma manual / webhook confirma automático
  → mesa quitada → sessão fecha
```

### Balcão (`balcao`)

```
Cliente abre /slug/balcao
  → check-in leve
  → cardápio → pedido
  → pagamento (PIX manual | dinheiro)
  → pedido #42 · tela "pronto"
  → retirada no balcão
```

### Salão + balcão (`salao_balcao`)

Ambos fluxos acima, `operational_mode = both`. Gateway único por restaurante.

---

## Gateways de pagamento — esteira de integrações

**Regra:** 100% na conta do restaurante · comissão Qomanda faturada dia 5 · sem split na hora da cobrança.

### v1 — Disponível (#1–#3)

| # | Provider | Métodos | Conexão |
|---|----------|---------|---------|
| 1 | **manual** | PIX | Chave PIX + confirmação manual |
| 2 | **cash** | Dinheiro | Sempre disponível · 0% comissão |
| 3 | **asaas** | PIX, crédito, débito | API key conta Asaas do restaurante |

### Ordem planejada — integrações v2+ (#4–#8)

| # | Provider | Métodos | Conexão prevista | Fase | Previsão |
|---|----------|---------|------------------|------|----------|
| 4 | **Mercado Pago** | PIX, crédito, débito | OAuth / credenciais vendedor | 3 | Q4 2026 |
| 5 | **PagBank** | PIX, crédito | OAuth conta PagSeguro | 3 | Q1 2027 |
| 6 | **Stone** | PIX, crédito | API e-commerce | 4 | 2027 |
| 7 | **Cielo** | Crédito, débito | Checkout Cielo / API | 4 | 2027 |
| 8 | **Getnet** | PIX, crédito | Sob demanda | Backlog | A definir |

> Tabela completa #1–#8 também em [`ROADMAP.md`](../ROADMAP.md) e na página pública [`/roadmap`](/roadmap).

### Implementação técnica (todas as integrações)

1. Estender `payment_gateway_provider` + credenciais criptografadas por restaurante  
2. Adapter em `PaymentProvider` (checkout, webhook, status)  
3. Painel Settings — conectar / testar / desconectar  
4. Registrar comissão em `payments` ao confirmar (mesmo fluxo atual)  
5. Sem split na cobrança — modelo conta do restaurante mantido

Código atual: `src/lib/payment-gateway-resolve.ts`, `restaurant-gateway.ts`, `restaurant-gateway-panel.tsx`

---

## Pricing (fechado)

| Item | Valor |
|------|-------|
| Implantação piloto | R$ 1.990 |
| Starter | R$ 199/mês · até 20 mesas |
| Growth | R$ 299/mês · até 50 mesas · −0,20 p.p. comissão |
| Pro | R$ 499/mês · até 100 mesas · −0,40 p.p. comissão |
| Comissão GMV digital | 2,99% → 2,49% → 1,99% → 1,49% (faixas) |
| Dinheiro na mesa | 0% |
| Fatura Qomanda | Mensal, dia 5 |

---

## Migrações Supabase — ordem recomendada

```text
1. migrate-internal-portal.sql
2. migrate-commercial-restaurant-account.sql
3. migrate-restaurant-manual-payment.sql
4. migrate-restaurant-model.sql
5. migrate-table-checkin-token.sql       ← QR anti-fraude (salão)
6. (outras pendentes: support, payout-bank, nfe, …)
```

---

## Arquivos-chave no código

| Área | Arquivo |
|------|---------|
| Modelos + preset | `src/lib/restaurant-models.ts` |
| Onboarding | `src/lib/restaurant-onboarding.ts` |
| Cadastro | `src/app/cadastro/page.tsx` |
| Checklist dashboard | `src/components/dashboard/restaurant-onboarding-panel.tsx` |
| Gateway | `src/components/dashboard/restaurant-gateway-panel.tsx` |
| Comissão | `src/lib/commission-tiers.ts`, `commission-billing.ts` |
| Balcão | `src/app/api/checkin/counter/`, `/[slug]/balcao` |
| Garçom | `/garcom` (mobile) · legado `/dashboard/waiter` → redirect |

---

## Como usar este documento

1. **Antes de codar:** confira em qual fase a tarefa cai; não pule Fase 2 se o objetivo é cliente na sexta.
2. **Novo modelo operacional:** adicionar em `restaurant-models.ts` com `status: 'coming_soon'` até o fluxo existir.
3. **Novo restaurante:** sempre passar pelo cadastro com modelo — evita configurar manualmente `operational_mode`.
4. **Revisão semanal:** marcar checkboxes neste arquivo + `ROADMAP.md`.

---

## Decisões explícitas (não reabrir agora)

- ❌ Marketplace split Asaas como padrão — adiado
- ❌ Anota Aí / delivery WhatsApp como foco — adiado
- ✅ Recebimento na conta do restaurante + gateway próprio
- ✅ PIX manual para destravar vendas sem Asaas
- ✅ Comissão faturada depois, não na hora do pagamento
