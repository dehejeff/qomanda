# Qomanda — Roadmap

> Última atualização: 2026-05-30  
> **Esteira detalhada (modelos, fases, go-live):** [`docs/ESTEIRA.md`](docs/ESTEIRA.md)

---

## 🚀 Próximas etapas (prioridade imediata)

> Ordem para go-live do primeiro cliente piloto. Detalhes em [`docs/ESTEIRA.md`](docs/ESTEIRA.md) · Fase 2.

| Prioridade | Entrega | Status |
|------------|---------|--------|
| **Agora** | Rodar migrações Supabase pendentes (billing, nfe, tables-public-read) | ⏳ Pendente |
| **P0** | Garçom confirmar PIX manual + dinheiro (`/garcom/pagamentos`) | ✅ Feito |
| **P0** | App garçom mobile — pedidos, pagamentos, mesas, benefícios, fechar mesa | ✅ Feito |
| **P0** | Smoke test E2E garçom (`/garcom`) | ✅ 16/16 |
| **P0** | Smoke test E2E módulos cliente (salão, balcão, híbrido, food hall) | ✅ 2026-06-02 |
| **P1** | Modelo operacional no portal interno (`/internal/clients/new`) | ✅ Feito |
| **P1** | Landing e roadmap alinhados (modelos + comissão mensal) | ✅ Feito |
| **P1** | Deploy do build atual (PIX manual, balcão, garçom, mensalidade) | ⏳ Pendente |
| **P2** | NF-e real Focus NFe (homologação/produção) | 🔴 Fase 3 |
| **P2** | NF-e de serviço Qomanda → restaurante | 🔴 Fase 3 |
| **P2** | Mercado Pago (#4 na esteira) | 🟡 v1 (access token + PIX/cartão) |
| **P2** | PagBank (#5), Stone (#6), Cielo (#7), Getnet (#8) — ver tabela #1–#8 abaixo | 🔴 Fase 3–4 |

**Não bloqueia piloto:** Asaas produção, marketplace split, rodízio, buffet por peso.

---

## 🍽️ Modelos operacionais (cadastro)

| Modelo | ID | Status | Fluxo |
|--------|-----|--------|-------|
| Salão com mesas | `salao` | ✅ Disponível | QR mesa · garçom · checkout |
| Balcão / fast food | `balcao` | ✅ Disponível | Link `/balcao` · pedido # |
| Salão + balcão | `salao_balcao` | ✅ Disponível | Ambos fluxos |
| **Food hall / praça** | `food_hall` | ✅ Disponível | **Mesmo fluxo do balcão** — pedido #, PIX manual, aviso “pronto” |
| Rodízio / taxa fixa | `rodizio` | 🔜 Em breve | — |
| Buffet por peso | `buffet_peso` | 🔜 Em breve | — |

> Detalhamento: [`docs/modulos/SALAO.md`](docs/modulos/SALAO.md) · [`BALCAO.md`](docs/modulos/BALCAO.md) · [`SALAO_BALCAO.md`](docs/modulos/SALAO_BALCAO.md) · [`FOOD_HALL.md`](docs/modulos/FOOD_HALL.md)

> Food hall v2 (comanda única multi-estação) fica para Fase 4; **v1 já serve praça de alimentação** com preset balcão.

---

## 💳 Gateways de pagamento — ordem planejada (#1–#8)

> **Regra em todos os gateways:** cobrança na **conta do restaurante** (100% do valor). Comissão Qomanda sobre GMV digital, **faturada mensalmente (dia 5)** — sem split na hora da venda.  
> Arquitetura alvo: interface `PaymentProvider` unificando checkout, webhooks e credenciais por restaurante (`payment_gateway_provider`).

| # | Gateway | Métodos | Como conecta | Fase | Previsão |
|---|---------|---------|--------------|------|----------|
| **1** | **PIX manual** | PIX | Chave PIX do restaurante + confirmação no painel | v1 | ✅ Disponível |
| **2** | **Dinheiro** | Cash | Cliente informa · garçom/dono confirma (0% comissão) | v1 | ✅ Disponível |
| **3** | **Asaas** | PIX, crédito, débito | API key da **conta Asaas do restaurante** | v1 | ✅ Disponível |
| **4** | **Mercado Pago** | PIX, crédito, débito | Access token da conta MP do restaurante | v1 | ✅ Disponível |
| **5** | **PagBank** (PagSeguro) | PIX, crédito | OAuth ou token API conta vendedor | Fase 3 | Q1 2027 |
| **6** | **Stone** | PIX, crédito | API e-commerce / link na conta Stone | Fase 4 | 2027 |
| **7** | **Cielo** | Crédito, débito | API e-commerce (Checkout Cielo) | Fase 4 | 2027 |
| **8** | **Getnet** (Santander) | PIX, crédito | Sob demanda (enterprise) | Backlog | A definir |

### Por gateway — escopo técnico (v2+)

- [ ] **Abstração `PaymentProvider`** — resolver gateway no checkout, webhooks e painel Settings
- [ ] **Mercado Pago**
  - [ ] OAuth connect + refresh token criptografado
  - [ ] PIX QR dinâmico + cartão no checkout
  - [ ] Webhook confirmação → `confirmPaymentRecord` + comissão
  - [ ] UI Settings: conectar / desconectar conta MP
- [ ] **PagBank**
  - [ ] Onboarding vendedor + PIX/cartão
  - [ ] Webhooks e reconciliação
- [ ] **Stone**
  - [ ] Link de pagamento ou API direta
  - [ ] Suporte a parcelamento no checkout
- [ ] **Cielo**
  - [ ] Checkout transparente ou redirect
  - [ ] Tokenização de cartão (Hub do cliente)

### Fora do escopo imediato

- Marketplace split Asaas (opcional, legado) — não é padrão do modelo atual
- Maquininha física Stone/Cielo sem API — restaurante continua usando maquininha avulsa; Qomanda não cobra comissão
- Stripe — avaliar apenas se houver demanda internacional

---

## ✅ MVP — Implementado

### Plataforma Cliente (PWA)
- [x] Scanner de QR Code (BarcodeDetector API + fallback manual)
- [x] Check-in com captura de nome, sobrenome e WhatsApp
- [x] QR Code por mesa com token único (`?mesa=&t=`) — anti-fraude entre restaurantes
- [x] Identificação única de cliente por WhatsApp (upsert)
- [x] PIN de 4 dígitos no login e check-in; setup automático para contas legadas
- [x] Home hub pós check-in com status de pedido em tempo real
- [x] Cardápio digital com categorias, fotos, promoções e sugestão do chef
- [x] Pedidos direto do celular com carrinho e stepper de quantidade
- [x] Acompanhamento de pedidos com barra de progresso animada
- [x] Checkout com divisão de conta automática
- [x] Telas de pagamento: PIX, Débito, Crédito, **Dinheiro** (confirmação manual pelo restaurante)
- [x] Tela de confirmação com código de validação
- [x] Perfil do cliente — editar dados, encerrar mesa (sem consumo em aberto), ir ao Hub
- [x] Área Hub do cliente (visitas, recibos, cartões, fidelidade)
- [x] Programa de fidelidade (contagem de visitas + recompensas automáticas)
- [x] Bottom nav com 5 tabs (Início, Cardápio, Pedidos, Pagamento, Perfil)

### Painel Administrativo (Dashboard)
- [x] Login com autenticação Supabase
- [x] Overview em tempo real (mesas ocupadas, pedidos abertos, receita do dia)
- [x] Mapa de mesas com status (livre/ocupada/reservada)
- [x] QR Code por mesa — download e impressão com número visível (Mesa X / T-XX)
- [x] Gestão de cardápio — criar/editar itens, foto (upload ou URL), preço promocional, sugestão do chef
- [x] Fila de pedidos (kanban: pendente → confirmado → preparando → pronto → entregue)
- [x] **Confirmar pagamento em dinheiro** — painel na mesa e em Pedidos · Mesa
- [x] Settings: aba **Mensalidade** (plano, estimativa, fatura em aberto, histórico PIX)
- [x] Settings: aba Pagamentos com histórico de transações
- [x] Settings: aba Fidelidade (configurar regras visitas → benefício)
- [x] Settings: aba Integrações — WhatsApp Business (credenciais Meta + teste de envio)
- [x] Settings: aba Pagamentos — cadastro de conta bancária de repasse (Qomanda Pay)
- [x] **Suporte** — abertura de tickets, mensagens e anexos (`/dashboard/support`)
- [x] Sidebar com navegação e logo

### Portal Interno Qomanda (Staff)
> Acesso em `/internal` — restrito à equipe Qomanda (`staff_users` ou `QOMANDA_STAFF_EMAILS`).

- [x] Login staff com Supabase Auth
- [x] **Overview** — KPIs (clientes, MRR planos, taxa tx 30d, receita Qomanda, volume Pay/GMV), gráficos de cadastros, distribuição de assinaturas/planos/Pay, fila de atenção e tickets abertos
- [x] **Clientes** — listagem, cadastro e edição com abas: Estabelecimento, NF-e cliente, Plano Qomanda, NF-e serviço
- [x] Perfil comercial por restaurante — plano, assinatura (trial/ativo), taxas custom, status Qomanda Pay
- [x] Reparo automático de billing para clientes legados (plano + assinatura + taxas)
- [x] Cadastro de perfil empresarial (CNPJ/CPF, endereço, ViaCEP)
- [x] Configuração NF-e ao consumidor (Focus NFe, status, leitura WhatsApp)
- [x] Painel NF-e de serviço (Qomanda → restaurante) — estrutura UI, emissão em breve
- [x] **Suporte** — fila interna de tickets com resposta staff e anexos
- [x] **Gateway Pay** — configuração Asaas da plataforma (credenciais criptografadas)
- [x] Script `scripts/setup-internal-staff.mjs` para provisionar contas da equipe

### Segurança & Pagamentos
- [x] **Recebimento na conta do restaurante** — PIX manual, Asaas (API do restaurante), dinheiro
- [x] Comissão progressiva sobre GMV digital — faturada mensalmente (dia 5), não split na hora
- [x] Recibos, códigos de confirmação e histórico de pagamentos
- [x] Pagamento de um cliente por outro (pool da mesa + WhatsApp ao beneficiário)
- [x] Senha de 6 dígitos para cartões salvos no Hub; sessão com idle 15 min / TTL 24 h
- [x] CPF criptografado + hash; WhatsApp como identidade única
- [x] Modo bypass de pagamentos para testes (`payment-bypass`)

### Infraestrutura
- [x] Schema Supabase completo (tabelas com RLS e triggers)
- [x] Realtime subscriptions (orders, sessions, tables)
- [x] Modo dev com mock data (DEV_BYPASS)
- [x] Tipagem TypeScript completa
- [x] Landing page — modelos operacionais, pricing com comissão mensal (não taxa por transação)
- [x] Roadmap público, Termos de Uso e Política de Privacidade
- [x] Migrações incrementais em `supabase/migrate-*.sql`

---

## 🏢 Jurídico & Financeiro (Pré-lançamento)

> Necessário para operar o Qomanda Pay em produção.

### Abertura de empresa
- [ ] Definir tipo societário — **SLU ou LTDA** (MEI não serve para marketplace de pagamentos)
- [ ] Escolher CNAEs — `6204-0/00` (TI), `6202-3/00` (software), avaliar `6619-3/99` (serviços financeiros auxiliares)
- [ ] Contratar contador e abrir CNPJ (~1–2 semanas, ~R$ 500–1.000)
- [ ] Abrir conta bancária PJ (Nubank PJ, Inter PJ ou similar)

### Asaas — conta master da plataforma
- [ ] Criar conta no **sandbox.asaas.com** com CPF para testar agora
- [ ] Adicionar `ASAAS_API_KEY` do sandbox no `.env.local` e testar split + subcontas
- [ ] Após ter CNPJ: criar conta em **asaas.com** (produção) com CNPJ da Qomanda
- [ ] Solicitar ativação do **marketplace/white-label** para o Asaas (aprovação manual por eles) — **obrigatório para split funcionar; testado em sandbox e confirmado que requer contato com suporte Asaas mesmo para CNPJ**
- [ ] Configurar API key de produção no portal interno (`/internal` → Gateway Pay)
- [ ] Configurar webhook de produção no painel Asaas apontando para o domínio da Vercel

---

## 🔴 Fase 1 — Fechamento do Projeto (Prioridade Máxima)

> Entregas restantes para operação comercial plena. **Junho 2026**

### 1. Qomanda Pay em produção (conta do restaurante)
- [x] Pagamentos via **conta Asaas do restaurante** (100% do valor)
- [x] Comissão progressiva registrada por pagamento + fatura mensal (dia 5)
- [x] Modo **balcão** — número do pedido + acompanhamento no celular
- [x] **App garçom mobile** (`/garcom`) — 4 abas: Pedidos · Pagamentos · Benefícios · Mesas
- [x] Garçom: fila pedidos, confirmar PIX/dinheiro, ver mesas, fechar mesa, alertas fidelidade
- [x] Redirect legado `/dashboard/waiter` → `/garcom`
- [x] **PIX manual** — chave do restaurante, sem Asaas obrigatório
- [x] **Cobrança automática mensalidade** — cron dia 5 + PIX Asaas master + webhook
- [ ] **Mercado Pago** — ver [esteira de gateways](#-gateways-de-pagamento--ordem-planejada-18)
- [ ] Marketplace split Asaas (legado, opcional — não é o modelo padrão)

### 2. Notas fiscais
- [x] Cadastro NF-e ao cliente (Focus NFe) — portal interno + campos no restaurante
- [x] Configuração WhatsApp para envio de NF-e — restaurante em Settings → Integrações
- [x] Tipo de nota por restaurante (NFC-e / NFS-e) — portal interno
- [x] **NF-e automática** — emissão após pagamento confirmado (adapter Focus NFe + modo simulado)
- [x] Envio da nota fiscal ao cliente via WhatsApp (quando `whatsapp_nfe_enabled`)
- [x] Vínculo pagamento → nota fiscal (aba Notas Fiscais no painel + recibo do cliente)
- [ ] Emissão real Focus NFe (depende do token de homologação/produção)
- [ ] **NF-e de serviço** — Qomanda → restaurante (junto com a fatura mensal)

### 3. Cobrança SaaS (mensalidade)
- [x] Planos comerciais (Starter / Growth / Pro / Enterprise)
- [x] Assinaturas por restaurante com trial
- [x] Faturas manuais (registro interno)
- [x] **Cobrança automática de mensalidade** — cron dia 5 + cobrança PIX Asaas (master) + webhook marca paga
- [x] Aba "Mensalidade" no dashboard do restaurante (histórico + link da fatura em aberto)
- [ ] NF-e de serviço emitida junto com a fatura

### 4. Melhorias operacionais pós-lançamento
- [ ] Webhook de pagamentos robusto — retry, idempotência e logs de erro
- [ ] **Chamar Garçom** — botão no home do cliente envia notificação para o dashboard
- [ ] E-mail de notificação em novos tickets de suporte

---

## 🟠 Fase 1 — Lançamento (demais itens)

> Itens complementares pós-fechamento.

### Onboarding do Restaurante
- [x] **Fluxo de cadastro** — Conta → **modelo operacional** → estabelecimento (salão, balcão, salão+balcão, **food hall**)
- [x] **Preset automático** — `operational_mode`, gateway manual, mesas seed
- [x] **Trial automático (14 dias)** — provisionado ao criar conta
- [x] **Checklist “Primeiros passos”** no dashboard Overview
- [x] **Upload de logo do restaurante** — Supabase Storage + aba Perfil em Settings
- [x] **Garçom confirma pagamentos** — PIX manual + dinheiro em `/garcom/pagamentos`
- [x] **Modelo no portal interno** — cadastro de pilotos pela equipe Qomanda (P1)

### Fidelidade (Persistência)
- [x] **Salvar regras de fidelidade no Supabase** — loyalty_rules (implementado)
- [x] **Exibir benefício conquistado para o garçom** — aba Benefícios + alerta na fila (`/garcom/beneficios`)

---

## 🟡 Fase 2 — Crescimento (Q3 2026)

### Analytics
- [ ] Gráfico de receita por período (diário/semanal/mensal) no dashboard do restaurante
- [ ] Ranking de pratos mais pedidos
- [ ] Análise de horário de pico
- [ ] Ticket médio por mesa e por cliente
- [ ] Exportação de relatórios (CSV/PDF)

### Equipe & Permissões
- [x] **App garçom mobile** (`/garcom`) — pedidos, pagamentos, mesas, benefícios, fechar mesa
- [x] **Gestão de equipe** (Settings → Equipe) — convite de garçons
- [x] **Garçom confirma PIX manual e dinheiro** — fila + badge + alerta
- [x] **Benefícios de fidelidade visíveis ao garçom** — aba Benefícios + banner Pedidos
- [ ] Receber e responder alertas "Chamar Garçom"
- [ ] Controle de acesso refinado por perfil
- [ ] Log de atividades por colaborador

### Segurança
- [ ] **2FA** (Settings → Segurança) — autenticação de dois fatores
- [ ] Histórico de sessões do administrador
- [ ] Alertas de acesso suspeito

### Comunicação
- [ ] **WhatsApp Business API** — confirmação de pedido via WhatsApp
- [ ] Campanhas de promoção para clientes fiéis

---

## 🔵 Fase 3 — Escala (Q4 2026)

### Gateways de pagamento
> Esteira completa: [Gateways de pagamento](#-gateways-de-pagamento--esteira-de-integrações)

- [ ] Abstração `PaymentProvider` no checkout e webhooks
- [ ] **Mercado Pago** — OAuth, PIX + cartão, webhook (Q4 2026)
- [ ] **PagBank** — conta vendedor PagSeguro (Q1 2027)
- [ ] Cobrança automática comissão + mensalidade (dia 5)

### Multi-unidades
- [ ] Suporte a múltiplos restaurantes por conta
- [ ] Dashboard consolidado multi-unidade
- [ ] Transferência de clientes entre unidades

### Integrações
- [ ] **Impressora de cozinha** — integração com impressoras térmicas (Epson, Bixolon)
- [ ] **API pública** — para integrações com ERPs e sistemas de delivery
- [ ] **iFood / Rappi** — receber pedidos de delivery no mesmo painel

### Reservas
- [ ] Sistema de reserva de mesa (data, hora, nome, WhatsApp)
- [ ] Confirmação automática via WhatsApp
- [ ] Calendário de reservas no dashboard

### Produto
- [ ] **PWA instalável** — ícone na tela inicial do cliente (manifest + service worker)
- [ ] Multi-cardápio por turno (almoço / jantar / happy hour)
- [ ] Modo Quiosque para tablets nas mesas
- [ ] Reembolsos e disputas no painel
- [ ] Liquidação/reconciliação financeira mensal

---

## 🟣 Fase 4 — Gateways adicionais (2027)

- [ ] **Stone** — API e-commerce / link na conta do restaurante
- [ ] **Cielo** — Checkout Cielo (crédito e débito)
- [ ] **Getnet** — sob demanda de clientes enterprise
- [ ] Rodízio, buffet por peso (modelos operacionais)
- [ ] Food hall v2 — comanda única multi-estação (v1 = fluxo balcão já disponível)

---

## 📊 Status Resumido

| Área | Status | % Completo |
|---|---|---|
| Cliente — Fluxo principal | ✅ Completo | 98% |
| Cliente — Pagamento | ⚠️ Parcial | 88% |
| Cliente — Hub & segurança | ✅ Completo | 90% |
| Dashboard — Operação | ✅ Completo | 95% |
| Dashboard — Cardápio & QR mesas | ✅ Completo | 92% |
| Dashboard — Suporte | ✅ Completo | 85% |
| Dashboard — Analytics | 🔴 Faltando | 10% |
| Dashboard — Equipe/Segurança | ⚠️ Parcial | 55% |
| Portal Interno Qomanda | ✅ Completo | 85% |
| App Garçom (`/garcom`) | ✅ Completo | 95% |
| Pagamentos (conta restaurante) | ⚠️ Parcial | 88% |
| NF-e cliente (emissão) | ⚠️ Parcial | 60% |
| NF-e serviço (Qomanda) | 🔴 Faltando | 10% |
| Cobrança SaaS (mensalidade) | ✅ Completo | 90% |
| Fidelidade | ✅ Completo | 90% |
| WhatsApp | ⚠️ Parcial | 55% |
| Onboarding restaurante | ⚠️ Parcial | 75% |
| Legal (Termos + Privacidade) | ✅ Completo | 100% |
| Multi-unidades | 🔴 Faltando | 0% |

---

## 🗄️ Migrações Supabase (ordem sugerida)

| Arquivo | Conteúdo |
|---------|----------|
| `schema.sql` | Schema base (rodar primeiro em projetos novos) |
| `migrate-internal-portal.sql` | Planos, assinaturas, faturas, staff |
| `migrate-asaas-marketplace.sql` | Split/taxas por restaurante |
| `migrate-restaurant-payout-bank.sql` | Conta bancária de repasse |
| `migrate-restaurant-business-profile.sql` | Perfil empresarial (CNPJ, endereço) |
| `migrate-restaurant-nfe.sql` | Campos NF-e ao consumidor |
| `migrate-platform-asaas-config.sql` | Credenciais Asaas da plataforma |
| `migrate-commercial-restaurant-account.sql` | Gateway restaurante, comissão, balcão, equipe, faturas mensais |
| `migrate-restaurant-manual-payment.sql` | PIX manual (chave do restaurante) |
| `migrate-restaurant-model.sql` | Modelo operacional no cadastro + preset |
| `migrate-tables-public-read.sql` | Cliente (anon) lê número/status da mesa (sem expor token) |
| `migrate-restaurant-logo-storage.sql` | Bucket de logo do restaurante |
| `migrate-owner-birthdate.sql` | Data de nascimento do titular (subconta Asaas CPF) |
| `migrate-nfe-invoices.sql` | Notas emitidas + tipo de nota (NFC-e/NFS-e) |
| `migrate-billing-charge.sql` | Cobrança Asaas da mensalidade + customer de billing |
| `migrate-restaurant-members-rls.sql` | Garçom convidado lê `restaurant_members` + mesas |

Demais migrações em `supabase/migrate-*.sql` cobrem hub do cliente, PIN, pagamentos cash, fidelidade, etc.

---

*Roadmap sujeito a alterações conforme feedback de clientes e prioridades de negócio.*
