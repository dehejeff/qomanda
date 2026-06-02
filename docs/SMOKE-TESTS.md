# Smoke Tests — Status e Continuação

> Última sessão: 2026-06-02

Validação E2E de cada modelo operacional, dirigindo a UI real com Playwright.

---

## Progresso por módulo

| Módulo | Status | Data |
|--------|--------|------|
| **Salão com mesas** (`salao`) | ✅ PASS (12/12 etapas) | 2026-06-02 |
| **Balcão / fast food** (`balcao`) | ✅ PASS (12/12 + bug crítico corrigido) | 2026-06-02 |
| Salão + balcão (`salao_balcao`) | ⏳ Próximo | — |
| Food hall / praça (`food_hall`) | 🔴 Pendente | — |

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

## Como retomar (Salão + Balcão / `salao_balcao`)

Próximo módulo: `operational_mode: both`. Combina os dois fluxos — `/slug` deve oferecer **escolha** entre QR de mesa e balcão (não redireciona direto). Ver `[slug]/page.tsx` branch `isBothMode`. Adaptar `smoke-setup-*.js` com `restaurant_model: 'salao_balcao'`, `operational_mode: 'both'`, e seed de mesas (para o lado salão) + chave PIX (para o lado balcão).

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
