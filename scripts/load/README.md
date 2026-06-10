# Teste de carga

Harness em Node (sem k6/Artillery) que simula a **jornada concorrente do cliente**
— check-in → cardápio → perfil → pedido — e reporta p50/p95/máx + taxa de erro por etapa.

## Rodar

```bash
node scripts/load/load-test.mjs
```

### Configuração (env)

| Var | Padrão | O que é |
|-----|--------|---------|
| `LOAD_BASE` | `http://localhost:3000` | Alvo das rotas Next (use a URL de staging/prod para números reais) |
| `LOAD_VUS` | `20` | Jornadas concorrentes (≈ mesas simultâneas) |
| `LOAD_ITER` | `5` | Iterações por VU |
| `LOAD_TABLES` | `10` | Mesas por restaurante de teste |
| `LOAD_RESTAURANTS` | `1` | Quantidade de restaurantes isolados no seed |

Cenário do roadmap (**10 restaurantes × 20 mesas**):

```bash
LOAD_RESTAURANTS=10 LOAD_TABLES=20 LOAD_VUS=200 LOAD_ITER=3 node scripts/load/load-test.mjs
```

Ou atalho:

```bash
npm run load:10x20
```

Contra staging (latência Next representativa):

```bash
LOAD_BASE=https://staging.qomanda.app LOAD_RESTAURANTS=10 LOAD_TABLES=20 LOAD_VUS=200 LOAD_ITER=3 node scripts/load/load-test.mjs
```

## Isolamento e limpeza

Cria um **restaurante de teste dedicado** (owner + cardápio + mesas + clientes). Ao
final, deleta o restaurante (cascata remove sessões/pedidos/itens/mesas/cardápio) +
clientes + usuário owner. Não toca em dados reais.

## Como interpretar

- **Supabase (REST)** — leitura (cardápio) e escrita (sessão/pedido) usam o mesmo
  Supabase em dev e produção, então essas latências/erros **já são representativos**.
- **Rota Next (profile)** — rodando contra o `next dev` (Turbopack, processo único),
  a latência **não** reflete produção (Vercel serverless, build pronto). Para medir a
  camada Next de verdade, aponte `LOAD_BASE` para um deploy de staging/produção.

## Baseline (2026-06-05, dev local, 20 VUs × 5)

| Etapa | p50 | p95 |
|-------|----:|----:|
| Check-in (Supabase write) | 103ms | 256ms |
| Cardápio (Supabase read) | 52ms | 278ms |
| Pedido (Supabase write) | 98ms | 149ms |
| Profile (Next API, dev) | 1396ms | 1982ms* |

`*` lento por ser dev (Turbopack); ignorar para capacidade. 400 req · 0 erros.
