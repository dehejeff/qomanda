# Infra — Região Supabase (sa-east-1) + Connection Pooler (Supavisor)

> Runbook do item de go-live "Supabase em `sa-east-1` + pooler".
> **Resumo:** região é operação no painel (não dá para trocar in-place); o pooler
> **não entra no runtime deste app** (usamos `supabase-js`/PostgREST por HTTPS, sem
> conexão Postgres direta). O ganho real de escala em código é **higiene de Realtime**.

---

## 0. Como este app conecta no banco (contexto)

| Caminho | Tecnologia | Porta/Protocolo | Pooler relevante? |
|---------|-----------|------------------|-------------------|
| App (browser + API routes) | `@supabase/supabase-js` → **PostgREST** | 443 / HTTPS | ❌ Não — PostgREST já faz pool no servidor |
| Auth (cookies SSR) | `@supabase/ssr` | 443 / HTTPS | ❌ Não |
| Realtime (KDS, garçom, checkout) | WebSocket Supabase Realtime | 443 / WSS | ❌ (mas tem **limite de canais** — ver §3) |
| Migrações / SQL admin / BI | conexão Postgres direta (psql, `supabase db`, ferramentas) | **6543 (pooler)** ou 5432 (direta) | ✅ **Sim** — usar 6543 |

Não há `DATABASE_URL`, `pg`, Prisma ou Drizzle no projeto. Confirmado em
`src/lib/supabase/*` (tudo `createClient` do `@supabase/supabase-js`).

> **Conclusão:** o "evita too many connections" do roadmap **não se aplica ao runtime**
> deste app. O pooler 6543 só é necessário se/quando você rodar migrações ou ligar
> ferramentas externas (Metabase, DBeaver, etc.) por conexão direta.

---

## 1. Região `sa-east-1` (São Paulo) — operação

A região é fixada na **criação** do projeto e **não pode ser alterada** depois.

### 1.1 Verificar a região atual
- Supabase Dashboard → **Project Settings → General → Region**.
- Se já estiver `South America (São Paulo) / sa-east-1`: **nada a fazer** — marque o item como ✅.

### 1.2 Se NÃO estiver em sa-east-1 (migração de projeto)
1. Criar **novo projeto** Supabase na região `sa-east-1` (mesmo org).
2. **Schema:** rodar `supabase/schema.sql` + todas as `supabase/migrate-*.sql`
   na ordem do `ROADMAP.md` § Migrações.
3. **Dados:** `pg_dump` (somente dados, `--data-only --column-inserts`) do projeto
   antigo e restaurar no novo, OU exportar/importar por tabela. Validar FKs.
4. **Storage:** migrar buckets (logos, imagens de cardápio) — baixar e re-subir
   (`supabase storage` / script). Buckets: ver `supabase/migrate-*storage*.sql`.
5. **Auth:** exportar/importar usuários (owners + staff). Senhas não migram em texto;
   donos podem precisar de "reset de senha" no primeiro acesso. Staff via
   `scripts/setup-internal-staff.mjs`.
6. **Realtime:** reativar a publicação `supabase_realtime` para as tabelas
   (orders, order_items, sessions, payments, restaurant_notifications,
   close_requests, close_request_participants, session_participants) — ver
   `migrate-realtime-*.sql`.
7. **Env vars (Vercel → Production + Preview + Local):** trocar
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY` para os do novo projeto.
8. **Webhooks de gateway** (Asaas/Mercado Pago) continuam apontando para a Vercel
   (não mudam com a região). Conferir mesmo assim.
9. Redeploy e smoke test (`npm run smoke:garcom`, fluxos de check-in/pedido/pagamento).
10. Só então desativar o projeto antigo.

> Janela de manutenção recomendada: fazer fora do horário de pico do piloto.
> Sem clientes em produção ainda, a migração é trivial — **prefira já criar o
> projeto de produção direto em sa-east-1** e evitar a migração.

---

## 2. Connection Pooler (Supavisor 6543) — quando usar

Só para **conexões Postgres diretas** (não o app). Pegue a string em
Dashboard → **Project Settings → Database → Connection string → "Transaction"**
(porta **6543**, modo transaction — ideal para serverless/efêmero) ou
**"Session"** / direta (porta **5432** — para migrações longas / DDL).

- **Migrações** (`schema.sql`, `migrate-*.sql`): rodar via SQL Editor do Dashboard
  (mais simples) ou `psql` na **porta 5432** (DDL prefere conexão direta/session).
- **Ferramentas/BI externas** (Metabase, DBeaver, scripts `pg`): usar **6543**
  (transaction pooling) com `?pgbouncer=true` e `prepared_statements=false`.
- **App Next.js:** nada a configurar — não usa conexão direta.

> Se um dia entrar `pg`/Prisma/Drizzle no projeto, **aí sim** o `DATABASE_URL` deve
> usar a porta 6543 (pooler) em produção serverless. Hoje não há.

---

## 3. O risco real de escala neste app: higiene de Realtime (código)

Supabase limita **conexões/canais simultâneos de Realtime** por plano. Como cada
aba do cliente/garçom/cozinha abre canais, o ponto de pressão é o Realtime — não o
Postgres. Melhorias possíveis (código, follow-up):

- **Assinaturas sem filtro** (recarregam em qualquer mudança global da tabela):
  - `waiter-orders-queue.tsx` e `dashboard/waiter/page.tsx`: canal em `orders`/`payments` sem filtro de restaurante.
  - `kitchen-display.tsx`: canal em `orders` sem filtro.
  - `checkout/page.tsx`: canal em `close_request_participants` sem filtro (adicionado no fluxo de divisão).
  - **Ação:** filtrar por `restaurant_id`/`session_id` quando possível, ou consolidar canais.
- **Polls de fallback** já existem (12–15s) — bom; manter como rede de segurança.
- **Plano Supabase Pro** eleva os limites de Realtime/conexões — combinar com a higiene acima.

> Estas otimizações são opcionais para o piloto (poucos restaurantes) e entram na
> Fase 1 de escala. Não bloqueiam go-live.

---

## 4. Checklist objetivo deste item

- [ ] Conferir região atual no Dashboard.
- [ ] Se não for sa-east-1 e ainda **sem clientes**: recriar o projeto de produção em sa-east-1 (passos §1.2).
- [ ] Garantir migrações aplicadas no projeto de produção (`ROADMAP.md` § Migrações).
- [ ] Confirmar publicação `supabase_realtime` com as tabelas necessárias.
- [ ] (Só se usar ferramenta externa/migração por CLI) usar a string do pooler **6543**.
- [ ] (Fase de escala) revisar assinaturas Realtime sem filtro (§3).
