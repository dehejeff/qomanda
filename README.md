# Qomanda

Plataforma SaaS de **cardápio digital**, **pedidos na mesa** e **pagamento integrado** para restaurantes e bares.

- **Cliente (PWA):** scan QR → check-in → cardápio → pedidos → checkout (PIX, cartão, dinheiro)
- **Dashboard (restaurante):** mesas, pedidos, cardápio, pagamentos, integrações, suporte
- **Portal interno (staff Qomanda):** overview comercial, clientes, suporte, gateway Pay

Deploy: [qomanda-mu.vercel.app](https://qomanda-mu.vercel.app)

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| App | Next.js 16 (App Router) + TypeScript |
| UI | Tailwind CSS 4 |
| Backend | Supabase (Postgres, Auth, Realtime, Storage) |
| Pagamentos | Asaas (Qomanda Pay — marketplace/split) |
| Deploy | Vercel |

---

## Desenvolvimento local

```bash
cp .env.example .env.local   # se existir; ou crie manualmente
npm install
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000).

### URLs úteis

| Fluxo | URL |
|-------|-----|
| Landing | `/` |
| Login restaurante | `/login` |
| Dashboard | `/dashboard` |
| Portal interno | `/internal/login` |
| Scanner cliente | `/scan` |
| Roadmap público | `/roadmap` |

Com `NEXT_PUBLIC_DEV_BYPASS=true`, auth é ignorada em dev (dashboard e portal interno).

---

## Documentação

| Documento | Descrição |
|-----------|-----------|
| [docs/DOCUMENTACAO.md](docs/DOCUMENTACAO.md) | Documentação técnica completa |
| [ROADMAP.md](ROADMAP.md) | Roadmap interno com status detalhado |
| [AGENTS.md](AGENTS.md) | Regras para agentes de código |

---

## Supabase

1. Criar projeto em [supabase.com](https://supabase.com)
2. Rodar `supabase/schema.sql` no SQL Editor
3. Rodar migrações em `supabase/migrate-*.sql` (ver ordem em [ROADMAP.md](ROADMAP.md))
4. Habilitar Realtime nas tabelas operacionais (`orders`, `sessions`, `tables`, etc.)

### Equipe interna

```bash
node scripts/setup-internal-staff.mjs
```

Requer `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`. Define `QOMANDA_STAFF_EMAILS` no Vercel para fallback de acesso.

---

## Variáveis de ambiente (essenciais)

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

ASAAS_API_KEY=
ASAAS_ENVIRONMENT=sandbox          # ou production
ASAAS_WEBHOOK_TOKEN=

CPF_ENCRYPTION_KEY=                # 64 chars hex
CPF_HASH_SALT=                     # 64 chars hex

NEXT_PUBLIC_APP_URL=https://...
QOMANDA_STAFF_EMAILS=ops@qomanda.com

# Opcional — criptografia credenciais gateway plataforma
PLATFORM_SECRETS_KEY=
```

Lista completa em [docs/DOCUMENTACAO.md § Variáveis de Ambiente](docs/DOCUMENTACAO.md#14-variáveis-de-ambiente).

---

## Scripts

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run lint` | ESLint |

---

## Licença

Proprietário — © 2026 Qomanda
