# Smoke Tests — Status e Continuação

> Última sessão: 2026-06-02

Validação E2E de cada modelo operacional, dirigindo a UI real com Playwright.

---

## Auditoria de persistência do painel (2026-06-02)

Varredura: cada campo grava e lê do Supabase real (sem mock). Causa raiz de
"dados não salvavam": `requireRestaurantAccess` retornava `mock-restaurant-id`
sob `DEV_BYPASS` antes de checar o usuário real → APIs de dono atualizavam 0 linhas.

| Campo / painel | API | Persiste? |
|----------------|-----|-----------|
| Perfil — nome | `/api/dashboard/profile` | ✅ |
| Perfil — telefone | idem | ✅ (máscara reescrita) |
| Perfil — logo | `/api/dashboard/profile/logo` | ✅ |
| Pagamentos — provider/chave PIX | `/api/dashboard/gateway` | ✅ |
| Pagamentos — modo operacional (tipo) | idem | ✅ (não bloqueia mais sem chave) |
| Pagamentos — conta bancária (legado) | `/api/dashboard/payout/bank-account` | ✅ |
| Fidelidade — regras | client → `loyalty_rules` | ✅ |
| Integrações — WhatsApp | `/api/dashboard/integrations/whatsapp` | ✅ |
| Equipe — membros | `/api/dashboard/members` | ✅ |

Correções: `requireRestaurantAccess` (mock só sem login), gateway não dá 400 por
falta de chave PIX, máscara de telefone do Perfil, `NEXT_PUBLIC_DEV_BYPASS=false`.

---

## Progresso por módulo

| Módulo | Status | Data |
|--------|--------|------|
| **Salão com mesas** (`salao`) | ✅ PASS (12/12 etapas) | 2026-06-02 |
| **Balcão / fast food** (`balcao`) | ✅ PASS (12/12 + bug crítico corrigido) | 2026-06-02 |
| **Salão + balcão** (`salao_balcao`) | ✅ PASS (ambos fluxos, sem bugs) | 2026-06-02 |
| **Food hall / praça** (`food_hall`) | ✅ PASS (fluxo counter + título próprio) | 2026-06-02 |
| **App Garçom** (`/garcom`) | ✅ PASS (16/16) | 2026-05-30 |

> **Todos os modelos de cliente + app garçom validados.** Rodízio e buffet por peso ainda são "em breve" no produto.

---

## ✅ App Garçom — resultado (2026-05-30)

**16/16 passou** via `scripts/smoke/garcom-smoke.mjs` (Playwright + Supabase service role).

| Passo | Resultado |
|-------|-----------|
| Login garçom convidado | ✅ |
| Fila pedidos + avançar status | ✅ |
| Benefícios fidelidade (API + UI) | ✅ |
| Mesas + sheet + solicitar fechamento | ✅ |
| Confirmar pagamento dinheiro | ✅ |
| Redirect `/dashboard/waiter` → `/garcom` | ✅ |

### Corrigido durante o smoke
- **RLS `restaurant_members`** — garçom convidado não resolvia `restaurant_id` no client → fallback `/api/dashboard/waiter/me` + migração `migrate-restaurant-members-rls.sql`
- **Mesas via API** — garçom não lia `tables` (policy owner-only) → `GET /api/dashboard/waiter/tables`
- **Sheet mesa** — botão de fechamento coberto pelo bottom nav → `pb-32` no sheet

---

## ✅ Salão com mesas — resultado

Fluxo completo validado: cadastro → login → mesas → check-in (token real) → cardápio → pedido → fila do dashboard → progressão de status (pendente→confirmado→preparando→pronto→entregue) → checkout → pagamento dinheiro → aguardando confirmação.

### Corrigido nesta sessão
- **BLOCKER:** 3 migrações não estavam aplicadas no banco (causava cadastro 400). Consolidadas em `supabase/RODAR-MIGRACOES-PENDENTES.sql` e aplicadas.
- Mensagens de erro amigáveis no cadastro (`src/lib/supabase/auth-errors.ts` → `friendlyAuthError`).
- `middleware.ts` → `proxy.ts` (Next.js 16).

### Achados em aberto (verificar)
1. ⚠️ **`Mesa .` sem número** na tela de pagamento em dinheiro (`checkout/page.tsx:761`/`494`). Dado existe no banco; suspeita de timing de render. Reproduzir manualmente: check-in mesa 1 → pedido → checkout → dinheiro → ver tela "Aguardando confirmação".
2. 🔍 **Taxa de serviço ~10%** aplicada no checkout (R$ 89,90 → R$ 98,89). Confirmar se é intencional e se deve ser discriminada ao cliente.
3. 🔍 **PIX manual não aparece** sem `manual_pix_key` configurada — onboarding deveria exigir/destacar isso, senão o restaurante só recebe dinheiro.
4. 🔍 **Rate limit de email** Supabase (free: 3 signups/hora). Configurar SMTP custom para produção.

---

## ✅ Balcão / fast food — resultado

Fluxo completo validado: redirect `/slug`→`/balcao` → check-in leve → cardápio → pedido **#1** → fila do dashboard → checkout simplificado (sem "fechar mesa toda", mostra "Pagar meu pedido") → PIX manual com chave + copia-e-cola → segundo pedido incrementa para **#2**.

### Corrigido nesta sessão
- 🔴 **BUG CRÍTICO:** check-in do balcão redirecionava para `/menu?balcao=1` (sem `?session=`). O menu exige `?session=` e jogava o cliente de volta para `/{slug}` → `/balcao` (loop) — **cliente do balcão nunca chegava ao cardápio**. Fix: `balcao/page.tsx` agora redireciona para `/menu?session=${sessionId}` (o `service_mode=counter` continua via localStorage). Confirmado em runtime antes e depois do fix.

### Achados
- 🔍 Mesma taxa de serviço ~10% do salão aplica no balcão (R$ 32 → R$ 35,20). Confirmar intenção.
- ✅ PIX manual aparece corretamente quando `manual_pix_key` configurada (diferente do salão, onde não testamos com chave).

---

## ✅ Salão + Balcão — resultado

`operational_mode: both`. Ambos os fluxos validados num mesmo restaurante, **sem bugs**:
- `/slug` **não redireciona** — oferece escolha "Escanear QR da mesa" **ou** "Pedir no balcão".
- Lado salão: check-in via QR mesa (token) → pedido (Mesa 1).
- Lado balcão: `/balcao` → check-in leve → pedido **#1** (beneficiado pelo fix de sessão do módulo balcão).
- Dashboard mostra os dois pedidos com coluna "Local" distinta: **Mesa 1** (salão) vs **#1** (balcão).

Scripts: `smoke-setup-both.js`, `smoke-e2e-both.js`.

---

## ✅ Food hall / praça — resultado

`restaurant_model: food_hall`, `operational_mode: counter`. Usa o mesmo fluxo do balcão com título próprio. Validado E2E (12/12), **sem bugs**:
- Página `/balcao` mostra título **"Praça de alimentação"** (não "Pedido no balcão").
- Check-in → cardápio → pedido **#1** → fila dashboard → checkout simplificado → PIX manual → segundo pedido **#2**.

Scripts: `smoke-setup-foodhall.js`, `smoke-e2e-foodhall.js`.

---

## App Garçom (`/garcom`) — smoke E2E

Script versionado: `scripts/smoke/garcom-smoke.mjs`

| # | Passo | Esperado |
|---|-------|----------|
| 1 | Setup service role — restaurante + garçom + mesa ocupada + pedido + pagamento cash + benefício | Dados no Supabase |
| 2 | Login `/login?perfil=garcom` | Redirect `/garcom/pedidos` |
| 3 | Fila de pedidos | Alerta pagamento + avançar status |
| 4 | `/garcom/pagamentos` | Confirmar dinheiro |
| 5 | `/garcom/beneficios` | Benefício visível por mesa |
| 6 | `/garcom/mesas` → toque mesa | Sheet + solicitar fechamento |
| 7 | `/dashboard/waiter` | Redirect → `/garcom` |

```bash
npm run dev   # terminal 1
npm install --save-dev playwright
npx playwright install chromium
node scripts/smoke/garcom-smoke.mjs
```

---

## Resumo final (todos os módulos)

| Bug/achado | Módulo | Status |
|------------|--------|--------|
| 3 migrações não aplicadas (cadastro 400) | Salão | ✅ corrigido (migração + rodada) |
| Mensagens de erro cruas no cadastro | Salão | ✅ corrigido (`friendlyAuthError`) |
| `middleware.ts` → `proxy.ts` (Next 16) | — | ✅ corrigido |
| **Check-in balcão não chegava ao cardápio** | Balcão | ✅ **corrigido** (redirect com `?session=`) |
| **`Mesa .` sem número no pagamento/recibo** | Salão | ✅ **corrigido** — era RLS (ver abaixo) |
| Taxa de serviço ~10% no checkout | Todos | ✅ não é bug — seção própria, exibida e **opcional** (toggle) |
| PIX manual exige config prévia da chave | Todos | ✅ não é bug — onboarding já exige gateway (`gatewayReady`) |

### Investigação do "Mesa ." (bug real corrigido)
Causa raiz: a tabela `tables` tinha RLS só com policy `owner_all` — o cliente (role `anon`) recebia `table=null` no join `sessions.select('*, table:tables(number)')`, deixando `tableNumber` vazio no checkout **e nos recibos** de todos os clientes de salão.
Fix: `supabase/migrate-tables-public-read.sql` concede a `anon` leitura de `number/status` (colunas públicas — já impressas na mesa) **sem** expor `check_in_token` (segredo anti-fraude, via grant por coluna). Dono (`authenticated`) intocado. Validado: tela de pagamento agora mostra "Mesa 1". Também: `CashPendingScreen` agora degrada com elegância se o número faltar/for balcão.

## Como retomar (instruções gerais)

### 1. Pré-requisitos do ambiente
```powershell
# Servidor rodando
npm run dev

# Playwright (foi removido do devDeps; reinstalar para rodar os scripts)
npm install --save-dev playwright
$env:PLAYWRIGHT_BROWSERS_PATH = "C:\Users\Jeffe\AppData\Local\ms-playwright"
```
> Browsers do Playwright já estão baixados em `C:\Users\Jeffe\AppData\Local\ms-playwright`.

### 2. Scripts de smoke (locais, gitignored)
- `smoke-setup.js` — cria via service role: user confirmado + restaurante + mesas + cardápio + billing. Salva IDs em `%TEMP%/smoke-data.json`.
- `smoke-e2e.js` — dirige a UI (Playwright) usando `smoke-data.json`.

**Para o módulo Balcão**, adaptar `smoke-setup.js`:
- `restaurant_model: "balcao"`, `operational_mode: "counter"`
- Balcão não usa mesa/QR — o cliente entra por `/{slug}/balcao`, recebe número de pedido (#), paga na hora.
- Fluxo de check-in é diferente: ver `src/app/(customer)/[slug]/balcao/page.tsx` e `src/app/api/checkin/counter/route.ts`.
- Pedido gera `display_number` via `src/app/api/orders/counter-number/route.ts`.

### 3. Rodar
```powershell
node smoke-setup.js   # ajustado para balcao
node smoke-e2e.js     # ajustado para o fluxo de balcao
```

### 4. Documentar
Atualizar a tabela de progresso acima + listar achados/bugs do Balcão.

---

## Notas técnicas (descobertas úteis)

- **Email de teste:** usar TLD real (`@smoke.com`), não `@qomanda.test` — Supabase rejeita TLD fictício com 400.
- **Setup via service role** (REST direto, sem supabase-js): evita rate limit de email E o erro de WebSocket do supabase-js no Node 20. `admin.createUser` com `email_confirm: true` não dispara email.
- **Sessão na URL:** páginas do cliente (`/menu`, `/checkout`) leem `?session=<id>` da URL, não do localStorage. Sem isso, redirecionam para o check-in.
- **PinInput:** é um único `input[type=password][inputmode=numeric][maxlength=4]` com caixinhas visuais por cima (não inputs separados).
- **Check-in:** valida `tables.check_in_token` via `/api/checkin/verify`. Token fictício → "QR Code inválido".
- **Confirm email** já está desligado no Supabase Auth (signup gera sessão direto).
