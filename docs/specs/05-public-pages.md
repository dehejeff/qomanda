# Specs — Páginas Públicas e Landing

Rotas: `/(marketing)/*` + `/cadastro` + `/login` + `/politica-de-privacidade` + `/termos`
Auth: Nenhuma (páginas públicas). `/cadastro` cria conta nova.

---

## Página: `/` — Landing Page

**Arquivo**: `src/app/(marketing)/page.tsx` ou `src/app/page.tsx`

### Propósito
Página de conversão principal da Qomanda. Converte visitantes em restaurantes cadastrados.

### Seções

**Hero**
- Headline principal: proposta de valor.
- Sub-headline: benefícios.
- CTA primário: "Começar grátis por 14 dias" → `/cadastro`.
- CTA secundário: "Ver como funciona" (scroll anchor ou modal de vídeo).
- Imagem/mockup do app em uso.

**Como funciona**
- 3–4 passos em cards: Restaurante cria conta → Imprime QR Code → Cliente escaneia → Cliente pede e paga.
- Animação ou gif por passo.

**Funcionalidades**
- Grid de features: Cardápio digital, QR Code por mesa, Pagamento integrado, Fila de espera, NF-e automática, Relatórios, Multi-superfície (garçom/cozinha).

**Preços** (seção na landing)
- Cards de plano: Starter / Growth / Pro.
- Toggle mensal/anual (se houver desconto anual).
- CTA em cada card.
- Nota de trial gratuito.

**Depoimentos** (se houver)
- Cards com nome do restaurante, cidade, texto curto.

**FAQ**
- Accordion com perguntas frequentes: contrato, cancelamento, suporte, gateways aceitos, etc.

**CTA Final**
- "Crie sua conta agora" → `/cadastro`.

---

## Página: `/cadastro` — Criação de Conta do Restaurante

**Arquivo**: `src/app/(dashboard)/cadastro/page.tsx`

### Propósito
Onboarding de novo restaurante. Cria conta no Supabase Auth + registro em `restaurants`.

### Etapas (wizard multi-step)

**Etapa 1: Conta**
- Nome completo do responsável.
- E-mail.
- Senha + confirmação (mínimo 8 chars, 1 número, 1 maiúscula).

**Etapa 2: Restaurante**
- Nome do restaurante.
- Slug (auto-sugerido do nome, editável, validado como único).
- Modo operacional: salão, balcão, ambos.
- Telefone.

**Etapa 3: Localização** (opcional no cadastro, pode preencher depois nas Settings)
- Endereço completo.
- Cidade / Estado.

**Pós-cadastro**
- `POST /api/auth/register`:
  1. Cria usuário Supabase Auth.
  2. Cria registro em `restaurants`.
  3. Provisiona trial 14 dias (`provision-trial`).
  4. Cria `restaurant_subscriptions` com status `trial`.
  5. `ensureRestaurantBilling()`: cria cliente Asaas (assíncrono).
- Redireciona para `/dashboard` com onboarding checklist exibido.

---

## Página: `/politica-de-privacidade` — Política de Privacidade

**Arquivo**: `src/app/(marketing)/politica-de-privacidade/page.tsx`

Conteúdo legal estático (markdown ou rich text). Atualizado manualmente.

Cobertura obrigatória (LGPD):
- Dados coletados (nome, WhatsApp, CPF criptografado, histórico de pedidos).
- Como os dados são usados.
- Compartilhamento com terceiros (Asaas, Meta/WhatsApp, Focus NFe).
- Direitos do titular.
- Contato para solicitações de privacidade.
- Prazo de retenção.

---

## Página: `/termos` — Termos de Uso

**Arquivo**: `src/app/(marketing)/termos/page.tsx`

Termos de uso do serviço para restaurantes. Conteúdo legal estático.

Cobertura:
- Responsabilidades do restaurante vs Qomanda.
- Condições de pagamento e comissões.
- Cancelamento e retenção de dados.
- Limitação de responsabilidade.

---

## Página: `/roadmap` — Roadmap Público (interno)

**Arquivo**: `src/app/(marketing)/roadmap/page.tsx` OU `ROADMAP.md` renderizado.

Status de features planejadas, em desenvolvimento e entregues. Acesso não exige auth mas é voltado para restaurantes que acompanham o produto.

---

## Página: `/scan` — Scanner de QR Code

**Arquivo**: `src/app/scan/page.tsx`

Já documentado em [01-customer-pwa.md](./01-customer-pwa.md). Página pública, sem auth. Ponto de entrada para clientes que não conseguem escanear diretamente pelo camera roll do celular.

---

## Página de Login do Restaurante: `/login`

Já documentada em [02-dashboard.md](./02-dashboard.md).

---

## Redirects e Páginas de Erro

| Rota | Comportamento |
|------|--------------|
| `/` (se logado) | Redireciona para `/dashboard` |
| Rota inválida | Next.js `not-found.tsx` — 404 page |
| Erro de servidor | `error.tsx` — 500 page com botão "Voltar" |
| `/internal` sem auth staff | Redireciona para `/login?next=/internal` |
| `/dashboard` sem auth | Redireciona para `/login` |
