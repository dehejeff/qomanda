<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Quality Gate (mandatory)

All agent work is verified through the **quality-gate** orchestrator in `.agents/skills/quality-gate/SKILL.md`.

Before coding, read that skill. It applies:

| Skill | When |
|-------|------|
| `context-engineering` | Session start, new task |
| `owasp-security` | API, auth, payments, PII, sessions |
| `documentation-writer` | User-facing docs and summaries |

Cursor rule: `.cursor/rules/quality-gate.mdc` (always applied).

---

## Documentação do projeto

| Arquivo | Uso |
|---------|-----|
| `docs/DOCUMENTACAO.md` | Referência técnica completa |
| `ROADMAP.md` | Status de features e migrações |
| `docs/GO-LIVE-CHECKLIST.md` | Passo a passo de produção (config operacional) |
| `README.md` | Setup rápido |

Atualize `ROADMAP.md` e `docs/DOCUMENTACAO.md` quando entregar features significativas.

---

## Três superfícies da aplicação

| Superfície | Rotas | Auth |
|------------|-------|------|
| **Cliente (PWA)** | `src/app/(customer)/[slug]/*` | Sessão local (sessionId) |
| **Dashboard restaurante** | `src/app/(dashboard)/dashboard/*` | Supabase Auth (owner) |
| **Portal interno Qomanda** | `src/app/(internal)/internal/*` | Staff (`staff_users` + `QOMANDA_STAFF_EMAILS`) |

Libs por domínio:
- Cliente: `src/lib/customer-*`, `src/app/api/customer/*`
- Restaurante: dashboard pages + `src/app/api/dashboard/*`
- Staff: `src/lib/internal-*`, `src/lib/staff-auth.ts`, `src/app/api/internal/*`

---

## Caminhos sensíveis (OWASP)

Revisar com cuidado antes de alterar:

- `src/app/api/**` — todas as API routes
- `src/lib/customer-*` — PII do consumidor
- `src/lib/crypto.ts`, `src/lib/secret-crypto.ts` — criptografia
- `src/lib/asaas*.ts`, `src/lib/payment-bypass.ts` — pagamentos
- `src/lib/staff-auth.ts` — acesso portal interno
- `src/lib/internal-clients.ts` — billing e dados comerciais

---

## Portal interno — convenções

- Auth: `requireStaff()` em toda API `/api/internal/*`
- Billing: planos em `plans`, assinatura em `restaurant_subscriptions`, taxas em `restaurants.platform_fee_*`
- NF-e **cliente** (restaurante → consumidor) ≠ NF-e **serviço** (Qomanda → restaurante) — abas separadas no cadastro
- WhatsApp NF-e: restaurante configura em Settings; staff só lê status
- `ensureRestaurantBilling()` repara clientes legados sem plano/assinatura

---

## Migrações Supabase

Novas colunas/tabelas → arquivo `supabase/migrate-<nome>.sql` + atualizar `supabase/schema.sql` quando consolidar.

Ordem e descrição: `ROADMAP.md` § Migrações Supabase.
