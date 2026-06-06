# Qomanda — Roadmap

> Última atualização: 2026-06-06  
> **Esteira detalhada (modelos, fases, go-live):** [`docs/ESTEIRA.md`](docs/ESTEIRA.md)  
> **Checklist de go-live (passo a passo):** [`docs/GO-LIVE-CHECKLIST.md`](docs/GO-LIVE-CHECKLIST.md)

---

## 🚀 Próximas etapas (prioridade imediata)

> Ordem para go-live do primeiro cliente piloto. Detalhes em [`docs/ESTEIRA.md`](docs/ESTEIRA.md) · Fase 2.

| Prioridade | Entrega | Status |
|------------|---------|--------|
| **Agora** | Rodar migrações Supabase pendentes em produção (se ainda não aplicadas) | ⏳ Verificar |
| **P0** | Garçom confirmar PIX manual + dinheiro (`/garcom/pagamentos`) | ✅ Feito |
| **P0** | App garçom mobile — pedidos, pagamentos, mesas, benefícios, fechar mesa | ✅ Feito |
| **P0** | Check-in QR mobile — scanner html5-qrcode, redirect `/api/checkin/redirect`, retomada de sessão | ✅ Feito |
| **P0** | Modo operacional (salão/balcão/ambos) sincronizado Settings → Overview | ✅ Feito |
| **P0** | Smoke test E2E garçom (`/garcom`) | ✅ 16/16 |
| **P0** | Smoke test E2E módulos cliente (salão, balcão, híbrido, food hall) | ✅ 2026-06-02 |
| **P1** | Modelo operacional no portal interno (`/internal/clients/new`) | ✅ Feito |
| **P1** | Landing e roadmap alinhados (modelos + comissão mensal) | ✅ Feito |
| **P1** | Busca no header do dashboard (filtra pedidos) | ✅ Feito |
| **P1** | Deploy contínuo na Vercel (`qomanda-mu.vercel.app`) | ✅ Feito |
| **P0** | **Fixar região Supabase `sa-east-1` (SP) + connection pooler (Supavisor)** — prioridade de go-live | ▶️ Próximo |
| **P1** | Fila assíncrona — NF-e + WhatsApp fora do request de pagamento | ✅ Feito 2026-06-04 |
| **P1** | Webhooks idempotentes (Asaas / Mercado Pago) | ✅ Feito 2026-06-04 |
| **P1** | Chamar Garçom — sino realtime no dashboard + banner no app do garçom | ✅ Feito 2026-06-04 |
| **P0** | **Observabilidade — Sentry (5xx, fila, webhooks)** — prioridade de go-live | ✅ Código pronto (base + wiring) · falta criar conta/DSN + alertas (`docs/OBSERVABILITY-WIP.md`) |
| **P2** | Teste de carga — simular 10 restaurantes × 20 mesas | ⏳ Planejado |
| **P2** | NF-e real Focus NFe (homologação/produção) | 🔴 Fase 3 |
| **P2** | NF-e de serviço Qomanda → restaurante | ✅ Feito 2026-06-04 (simulado; real via env) |
| **P2** | Mercado Pago OAuth connect | 🟢 Código pronto · falta app MP + domínio qomanda.app |
| **P2** | PagBank (#5), Stone (#6), Cielo (#7), Getnet (#8) — ver tabela #1–#8 abaixo | 🔴 Fase 3–4 |

**Não bloqueia piloto:** Asaas produção, marketplace split, rodízio, buffet por peso.

---

## ✅ Entregue recentemente (jun/2026)

| Entrega | Detalhe |
|---------|---------|
| **KDS — Tela de cozinha** | Painel em tempo real (Novos/Preparando/Prontos) + comanda imprimível + auto-impressão |
| **Restrição de status por papel** | Cozinha avança até `pronto`; garçom/gerente/dono fazem `entregue` |
| **Perfil Caixa** | Novo papel `caixa` + página `/dashboard/caixa` (busca por código, confirma dinheiro/PIX) |
| **Segregação de acesso** | Cada papel vê só o que precisa (proxy + layouts): garçom→/garcom, cozinha→/cozinha, caixa→/dashboard/caixa |
| **Balcão ≠ mesa** | Balcão não conta no limite, não aparece no mapa, fluxo próprio (#número) — inclusive no modo `both` |
| **QR do balcão** | Geração de QR/link do balcão no painel para imprimir e expor |
| **Entrada do balcão** | Check-in rápido + login WhatsApp/PIN + CPF opcional (paridade com a mesa) |
| **Código de pagamento (dinheiro)** | Cliente vê código de referência; caixa confirma pelo mesmo código |
| **Realtime completo** | `sessions` no watch + polls de fallback (dashboard, garçom) — nada exige recarregar |
| **NF-e inline** | Emissão de NF-e + WhatsApp no próprio request de pagamento (sem depender do cron — plano Hobby) |
| **Opt-out de NF-e** | Restaurante pode não emitir nota ao consumidor (callout explícito) |
| **Fuso horário de pedidos** | Filtro "hoje" no fuso Brasil + pedidos em aberto não somem na virada do dia |
| **Nova precificação** | Mensalidade 299/399/599 + comissão flat 0,7/0,5/0,3% (ver tabela de planos) |
| **Página de Integrações** | `/integracoes` lista gateways, NF-e e WhatsApp |
| **UX cliente** | Check-in mais claro (1ª vez), carrinho destacado, card de pedidos multi-status, anti-fechamento acidental da mesa |

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
- [x] **Mercado Pago (v1)**
  - [x] Access token + PIX/cartão no checkout
  - [x] Webhook confirmação → `confirmPaymentRecord` + comissão
  - [x] UI Settings: credenciais MP (token manual)
- [~] **Mercado Pago (OAuth)** — código pronto (2026-06-04), aguardando app no MP
  - [x] OAuth connect + callback + state assinado (HMAC) + refresh token criptografado
  - [x] UI Settings: conectar / desconectar conta MP (token manual vira fallback)
  - [ ] **Criar app no Mercado Pago + definir `MERCADO_PAGO_CLIENT_ID/SECRET` no `.env`**
  - [ ] **Cadastrar Redirect URI `https://qomanda.app/api/dashboard/gateway/mercadopago/callback`** (fazer quando o domínio qomanda.app estiver ativo)
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
- [x] Scanner de QR Code — html5-qrcode (iOS/Android) + fallback manual
- [x] Redirect de check-in no servidor (`/api/checkin/redirect`) para mobile pós-câmera
- [x] Retomada de sessão e check-in rápido para clientes recorrentes
- [x] Check-in com captura de nome, sobrenome e WhatsApp
- [x] QR Code por mesa com token único (`?mesa=&t=`) — anti-fraude entre restaurantes
- [x] Identificação única de cliente por WhatsApp (upsert)
- [x] PIN de 4 dígitos no login e check-in; setup automático para contas legadas
- [x] Home hub pós check-in com status de pedido em tempo real
- [x] Cardápio digital com categorias, fotos, promoções e sugestão do chef
- [x] Pedidos direto do celular com carrinho e stepper de quantidade
- [x] Acompanhamento de pedidos com barra de progresso animada
- [x] Checkout com divisão de conta automática
- [x] Telas de pagamento: PIX (manual, Asaas, **Mercado Pago**), Débito, Crédito, **Dinheiro**
- [x] Tela de confirmação com código de validação
- [x] Perfil do cliente — editar dados, encerrar mesa (sem consumo em aberto), ir ao Hub
- [x] Área Hub do cliente (visitas, recibos, cartões, fidelidade)
- [x] Programa de fidelidade (contagem de visitas + recompensas automáticas)
- [x] Bottom nav com 5 tabs (Início, Cardápio, Pedidos, Pagamento, Perfil)

### Painel Administrativo (Dashboard)
- [x] Login com autenticação Supabase
- [x] Overview em tempo real — adaptado ao modo operacional (salão / balcão / ambos)
- [x] Checklist “Primeiros passos” no Overview
- [x] Modo operacional editável em Settings → Pagamentos (sincroniza `restaurant_model`)
- [x] Mapa de mesas com status (livre/ocupada/reservada)
- [x] QR Code por mesa — download e impressão com número visível (Mesa X / T-XX)
- [x] Gestão de cardápio — criar/editar itens, foto (upload ou URL), preço promocional, sugestão do chef
- [x] Fila de pedidos (kanban: pendente → confirmado → preparando → pronto → entregue)
- [x] **Busca no header** — filtra pedidos na fila (`/dashboard/orders`)
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
- [x] **Cobrança** — painel consolidado de mensalidades: status por cliente (paga / a vencer / em atraso com dias) + KPIs + emitir boleto/PIX + marcar paga + **e-mail automático ao gerar/atrasar** (cron diário) + **exportação CSV**
- [x] **Saúde do sistema** — `/internal/health`: monitor em tempo real (auto-refresh) da fila, webhooks, NF-e em erro e faturas em atraso, com status geral e feed de erros (independe do Sentry)
- [x] **Playbook do time** — `/internal/playbook` (escondida, staff-only): checklist completo de implementação (onboarding) + suporte (diagnóstico/procedimentos), marcável e imprimível
- [x] **Suporte** — fila interna de tickets com resposta staff e anexos
- [x] **Gateway Pay** — configuração Asaas da plataforma (credenciais criptografadas)
- [x] Script `scripts/setup-internal-staff.mjs` para provisionar contas da equipe

### Segurança & Pagamentos
- [x] **Recebimento na conta do restaurante** — PIX manual, Asaas, **Mercado Pago**, dinheiro
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
- [x] **Mercado Pago** — access token + PIX/cartão no checkout (v1)
- [x] **Cobrança automática mensalidade** — cron dia 5 + PIX Asaas master + webhook
- [~] **Mercado Pago OAuth** — connect/desconectar na UI pronto; falta criar o app no MP + `MERCADO_PAGO_CLIENT_ID/SECRET` + Redirect URI no domínio qomanda.app
- [ ] Marketplace split Asaas (legado, opcional — não é o modelo padrão)

### 2. Notas fiscais
- [x] Cadastro NF-e ao cliente (Focus NFe) — portal interno + campos no restaurante
- [x] Configuração WhatsApp para envio de NF-e — restaurante em Settings → Integrações
- [x] Tipo de nota por restaurante (NFC-e / NFS-e) — portal interno
- [x] **NF-e automática** — emissão após pagamento confirmado (adapter Focus NFe + modo simulado)
- [x] Envio da nota fiscal ao cliente via WhatsApp (quando `whatsapp_nfe_enabled`)
- [x] Vínculo pagamento → nota fiscal (aba Notas Fiscais no painel + recibo do cliente)
- [x] **NF-e de serviço** — Qomanda → restaurante, emitida ao pagar a fatura mensal (modo simulado; real via env `QOMANDA_NFE_*`)
- [ ] Emissão real Focus NFe (depende do token de homologação/produção — cliente e serviço)

### 3. Cobrança SaaS (mensalidade)
- [x] Planos comerciais (Starter / Growth / Pro / Enterprise)
- [x] Assinaturas por restaurante com trial
- [x] Faturas manuais (registro interno)
- [x] **Cobrança automática de mensalidade** — cron dia 5 + cobrança PIX Asaas (master) + webhook marca paga
- [x] Aba "Mensalidade" no dashboard do restaurante (histórico + link da fatura em aberto)
- [x] NF-e de serviço emitida ao pagar a fatura (webhook Asaas + "Registrar pagamento" interno)

### 4. Melhorias operacionais pós-lançamento
- [x] **Webhook de pagamentos robusto** — idempotência (tabela `webhook_events`) + logs de erro/retry (Asaas + Mercado Pago)
- [x] **Chamar Garçom** — botão no home do cliente → notificação realtime (sino no dashboard + banner no app do garçom)
- [x] **KDS — painel de cozinha** (`/cozinha`): tela cheia em tempo real (realtime + poll), colunas Novos/Preparando/Prontos, tempo por pedido, avançar status (rota server autoriza cozinha/garçom) + **comanda imprimível** (térmica) com auto-imprimir
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
- [x] **Modo operacional editável** — Settings → Pagamentos (reflete no Overview e checklist)
- [x] **Garçom confirma pagamentos** — PIX manual + dinheiro em `/garcom/pagamentos`
- [x] **Modelo no portal interno** — cadastro de pilotos pela equipe Qomanda (P1)

### Fidelidade (Persistência)
- [x] **Salvar regras de fidelidade no Supabase** — loyalty_rules (implementado)
- [x] **Exibir benefício conquistado para o garçom** — aba Benefícios + alerta na fila (`/garcom/beneficios`)

---

## 🟡 Fase 2 — Crescimento (Q3 2026)

### Analytics
- [x] Gráfico de receita por período (diário/semanal/mensal) no dashboard do restaurante
- [x] Ranking de pratos mais pedidos
- [x] Análise de horário de pico (faturamento por hora + dia da semana, fuso BR)
- [x] Métodos de pagamento (breakdown por PIX/cartão/dinheiro)
- [x] Ticket médio por mesa e por cliente
- [x] Exportação de relatórios — CSV (planilha) + HTML imprimível (Ctrl+P → PDF)

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
> Esteira completa: [Gateways de pagamento](#-gateways-de-pagamento--ordem-planejada-18)

- [ ] Abstração `PaymentProvider` no checkout e webhooks
- [x] **Mercado Pago v1** — access token, PIX + cartão, webhook (2026-06)
- [ ] **Mercado Pago OAuth** — connect na UI, refresh token criptografado
- [ ] **PagBank** — conta vendedor PagSeguro (Q1 2027)
- [x] Cobrança automática comissão + mensalidade (dia 5)

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
- [ ] **PWA instalável** — manifest + service worker (parcial)
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

## 🏗️ Infraestrutura & escala

> **Decisão de arquitetura (2026-06):** manter **Vercel** (app Next.js) + **Supabase** (Postgres, Auth, Realtime, Storage). O gargalo não é a hospedagem do frontend — é processamento síncrono (NF-e + WhatsApp no `confirm-payment`), conexões Postgres em serverless e falta de fila/observabilidade.  
> Detalhes técnicos: [`docs/DOCUMENTACAO.md`](docs/DOCUMENTACAO.md) § Arquitetura.

### Stack alvo por camada

| Camada | Tecnologia | Fase |
|--------|------------|------|
| App (SSR, API routes, PWA) | **Vercel Pro** | 0 — manter |
| Banco, Auth, Realtime, Storage | **Supabase Pro** (sa-east-1) | 0 |
| Trabalho pesado (NF-e, WhatsApp, retries) | **Fila** — Inngest, Trigger.dev ou Upstash QStash | 0 |
| Cache / rate limit | **Upstash Redis** | 1 (~30+ restaurantes) |
| Monitoramento | **Sentry** + dashboards Vercel/Supabase | 0 |
| Workers dedicados | Railway / Fly.io (só se fila + Vercel não bastarem) | 2 |

> **Decisão de arquitetura (2026-06-04):** avaliamos migrar para o GCP e **decidimos
> permanecer em Vercel + Supabase**. Ganho de performance/segurança não vem da nuvem e
> sim de **região (sa-east-1) + pooler + observabilidade**; migrar exigiria reescrever
> Auth/RLS/Realtime/Storage (alto custo e risco) sem ganho real no porte atual. GCP/Railway/Fly
> só entram em escala (Fase 2), e como híbrido para workers — não troca total.

### Fase 0 — Piloto → ~20 restaurantes (prioridade imediata)

- [ ] **▶️ Supabase em `sa-east-1` (São Paulo) + connection pooler (Supavisor, 6543)** — *prioridade de go-live escolhida*; latência BR, limites de Realtime/conexões, evita `too many connections`
- [x] **Fila assíncrona** — `async_jobs` + worker `/api/cron/process-jobs` (retry/backoff); `confirmPaymentRecord` enfileira `nfe_emit` (NF-e + WhatsApp) em vez de aguardar inline
- [ ] **Webhooks** Asaas/MP — responder 200 rápido, processar na fila, idempotência por `event_id`
- [ ] **Vercel Pro** — timeout 60s, mais concorrência, crons confiáveis (billing dia 5)
- [ ] **▶️ Finalizar Sentry** — wiring em jobs/webhooks + DSN + alerta e-mail/Slack em erro 5xx — *prioridade de go-live escolhida* (base pronta: `docs/OBSERVABILITY-WIP.md`)
- [ ] **Runbook** — modo degradado (pagamento OK, NF-e/WhatsApp na fila se provedor cair)

**Capacidade esperada:** dezenas a ~100 restaurantes no horário de pico, com pooler + fila + Pro.

### Fase 1 — Crescimento (~20–100 restaurantes)

- [x] **Rate limiting** — lib plugável (`src/lib/rate-limit.ts`) aplicada em rotas públicas sensíveis (login, verify-pin, register, call-waiter); janela em memória por padrão, **Upstash REST** quando configurado (`UPSTASH_REDIS_REST_*`)
- [ ] **Upstash Redis** — ligar o rate limit distribuído + cache de cardápio + locks de idempotência
- [x] **Índices Postgres** — `payments(restaurant_id,status,paid_at)`, `payments(asaas_payment_id)`, `orders(restaurant_id,created_at)`, `sessions(restaurant_id,status)` (`migrate-performance-indexes.sql`); _falta: alertas CPU/conexões no Supabase_
- [x] **WhatsApp em fila** — job `whatsapp_send` (NF-e enfileira em vez de enviar inline) com retry próprio + **throttle por restaurante** (20/min, limites Meta); worker adia sem consumir tentativa quando estoura
- [x] **Teste de carga** — harness Node (`scripts/load/`, jornada concorrente; sem k6/Artillery), configurável (`LOAD_VUS/ITER/BASE`). Baseline dev 20 VUs × 5: Supabase 0 erros (read p95 278ms, write p95 149ms). _Capacidade real: rodar contra staging via `LOAD_BASE`._
- [ ] **CDN** — imagens do cardápio (Vercel/Supabase Storage já cobrem; revisar cache headers)

### Fase 2 — Escala (~100+ restaurantes)

- [ ] **Workers dedicados** — Railway/Fly/AWS ECS só para webhooks e jobs, se serverless limitar
- [ ] **Postgres dedicado** (Neon/RDS) — se Supabase atingir limite; migrar gradualmente
- [ ] **Read replica / warehouse** — analytics pesado fora do OLTP (BigQuery, Metabase)
- [ ] **Multi-região** — só se expandir fora do Brasil

### Explicitamente fora do escopo imediato

- Migrar Next.js para Kubernetes “por segurança”
- VPS única self-managed (sem auto-scale)
- Microserviços separados por domínio (pedidos, pagamentos, NF-e)
- Multi-cloud desde o dia 1

### Fluxo alvo (pagamento → NF-e → WhatsApp)

```
Cliente confirma pagamento
  → API Vercel atualiza payment (paid) no Supabase
  → Enfileira jobs: emit_nfe, send_whatsapp
  → Responde 200 ao cliente (rápido)
  → Worker/fila chama Focus NFe + Meta WhatsApp com retry
  → Atualiza nfe_invoices no Supabase
```

---

## 📊 Status Resumido

| Área | Status | % Completo |
|---|---|---|
| Cliente — Fluxo principal | ✅ Completo | 99% |
| Cliente — Pagamento | ✅ Completo | 92% |
| Cliente — Hub & segurança | ✅ Completo | 90% |
| Dashboard — Operação | ✅ Completo | 96% |
| Dashboard — Cardápio & QR mesas | ✅ Completo | 94% |
| Dashboard — Suporte | ✅ Completo | 85% |
| Dashboard — Analytics | ✅ Completo | 95% |
| Dashboard — Equipe/Segurança | ⚠️ Parcial | 70% |
| Portal Interno Qomanda | ✅ Completo | 85% |
| App Garçom (`/garcom`) | ✅ Completo | 95% |
| Gateways (#1–4 disponíveis) | ✅ Completo | 85% |
| Gateways (#5–8 planejados) | 🔴 Faltando | 0% |
| NF-e cliente (emissão) | ⚠️ Parcial | 65% |
| NF-e serviço (Qomanda) | ⚠️ Parcial | 70% |
| Cobrança SaaS (mensalidade) | ✅ Completo | 90% |
| Fidelidade | ✅ Completo | 90% |
| WhatsApp | ⚠️ Parcial | 60% |
| Onboarding restaurante | ✅ Completo | 92% |
| Legal (Termos + Privacidade) | ✅ Completo | 100% |
| Infraestrutura & escala | ⚠️ Parcial | 20% |
| Observabilidade (Sentry + painel interno) | ⚠️ Parcial | 85% |
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
| `migrate-call-waiter.sql` | Chamar Garçom — tipo `call_waiter` em `restaurant_notifications` + RLS equipe |
| `migrate-realtime-notifications.sql` | Adiciona `restaurant_notifications` à publicação `supabase_realtime` (entrega realtime do sino/banner) |
| `migrate-webhook-events.sql` | Idempotência de webhooks (Asaas/Mercado Pago) — dedupe por `(provider, event_id)` |
| `migrate-mercadopago-oauth.sql` | Colunas OAuth do Mercado Pago (refresh token, public key, user id, via) |
| `migrate-async-jobs.sql` | Fila de jobs assíncronos (NF-e/WhatsApp) consumida pelo cron process-jobs |
| `migrate-billing-reminders.sql` | `last_reminder_at` em billing_invoices (throttle do lembrete de atraso) |
| `migrate-performance-indexes.sql` | Índices de performance (payments/orders/sessions) — analytics, webhooks, fila |
| `migrate-realtime-orders.sql` | Realtime de orders/order_items (KDS instantâneo; opcional — KDS tem poll) |
| `migrate-service-nfe.sql` | NF-e de serviço Qomanda → restaurante (`service_nfe_invoices`, 1 por fatura) |

Demais migrações em `supabase/migrate-*.sql` cobrem hub do cliente, PIN, pagamentos cash, fidelidade, etc.

---

*Roadmap sujeito a alterações conforme feedback de clientes e prioridades de negócio.*
