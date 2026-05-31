# Qomanda — Roadmap

> Última atualização: 2026-05-31

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
- [x] Settings: aba Pagamentos com histórico de transações
- [x] Settings: aba Fidelidade (configurar regras visitas → benefício)
- [x] Sidebar com navegação e logo

### Segurança & Pagamentos
- [x] Integração Qomanda Pay — PIX, crédito, webhook e modo bypass para testes
- [x] Recibos, códigos de confirmação e histórico de pagamentos
- [x] Pagamento de um cliente por outro (pool da mesa + WhatsApp ao beneficiário)
- [x] Senha de 6 dígitos para cartões salvos no Hub; sessão com idle 15 min / TTL 24 h
- [x] CPF criptografado + hash; WhatsApp como identidade única

### Infraestrutura
- [x] Schema Supabase completo (tabelas com RLS e triggers)
- [x] Realtime subscriptions (orders, sessions, tables)
- [x] Modo dev com mock data (DEV_BYPASS)
- [x] Tipagem TypeScript completa
- [x] Landing page de marketing com pricing e comparativo de mercado
- [x] Roadmap público, Termos de Uso e Política de Privacidade

---

## 🔴 Fase 1 — Fechamento do Projeto (Prioridade Máxima)

> Entregas restantes para operação comercial plena. **Junho 2026**

### 1. Configurar método de pagamento (self-service)
- [x] **Painel Settings → Pagamentos** — restaurante cadastra conta bancária de repasse
- [x] Status de validação visível no dashboard (pendente / ativo)
- [ ] PIX, crédito e débito liberados automaticamente após aprovação da conta
- [ ] Modo teste (bypass) desligável em produção

### 2. Notas fiscais
- [ ] **NF-e automática** — emissão após pagamento confirmado (integração SEFAZ / emissor configurável)
- [ ] Envio da nota fiscal ao cliente via WhatsApp (quando `whatsapp_nfe_enabled`)
- [ ] Vínculo pagamento → nota fiscal no histórico (cliente e painel)

### 3. Melhorias operacionais pós-lançamento
- [ ] Webhook de pagamentos robusto — retry, idempotência e logs de erro
- [ ] **Chamar Garçom** — botão no home do cliente envia notificação para o dashboard

---

## 🟠 Fase 1 — Lançamento (demais itens)

> Itens complementares pós-fechamento.

### Onboarding do Restaurante
- [ ] **Fluxo de cadastro do restaurante** — tela de sign-up pública para novos clientes
- [ ] **Wizard de configuração inicial** — nome, logo, endereço, horários
- [ ] **Upload de logo do restaurante** — Supabase Storage

### Fidelidade (Persistência)
- [ ] **Salvar regras de fidelidade no Supabase** — settings → loyalty_rules (atualmente UI only)
- [ ] **Exibir benefício conquistado para o garçom** — alerta no dashboard quando cliente atinge meta

---

## 🟡 Fase 2 — Crescimento (Q3 2026)

### Analytics
- [ ] Gráfico de receita por período (diário/semanal/mensal)
- [ ] Ranking de pratos mais pedidos
- [ ] Análise de horário de pico
- [ ] Ticket médio por mesa e por cliente
- [ ] Exportação de relatórios (CSV/PDF)

### Equipe & Permissões
- [ ] **App Garçom** — painel mobile-first dedicado (login em `/login?role=garcom`)
  - [ ] Confirmar pagamentos em dinheiro na mesa (notificação + confirmação em um toque)
  - [ ] Ver pedidos e status das mesas atribuídas
  - [ ] Receber e responder alertas "Chamar Garçom"
  - [ ] Marcar pedidos como entregues
- [ ] **Gestão de equipe** (Settings → Equipe) — convide garçons, cozinheiros, gerentes
- [ ] Controle de acesso por perfil (garçom: vê mesas / cozinheiro: vê fila / gerente: vê tudo)
- [ ] Log de atividades por colaborador

### Segurança
- [ ] **2FA** (Settings → Segurança) — autenticação de dois fatores
- [ ] Histórico de sessões do administrador
- [ ] Alertas de acesso suspeito

### Comunicação
- [ ] **WhatsApp Business API** — confirmação de pedido via WhatsApp
- [ ] Envio de nota fiscal via WhatsApp
- [ ] Campanhas de promoção para clientes fiéis

---

## 🔵 Fase 3 — Escala (Q4 2026)

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

## 📊 Status Resumido

| Área | Status | % Completo |
|---|---|---|
| Cliente — Fluxo principal | ✅ Completo | 98% |
| Cliente — Pagamento | ⚠️ Parcial | 88% |
| Cliente — Hub & segurança | ✅ Completo | 90% |
| Dashboard — Operação | ✅ Completo | 95% |
| Dashboard — Cardápio & QR mesas | ✅ Completo | 92% |
| Dashboard — Analytics | 🔴 Faltando | 10% |
| Dashboard — Equipe/Segurança | 🔴 Faltando | 0% |
| App Garçom | 🔴 Faltando | 5% |
| Pagamentos (Qomanda Pay self-service) | ⚠️ Parcial | 75% |
| NF-e | 🔴 Faltando | 0% |
| Fidelidade | ⚠️ Parcial | 75% |
| WhatsApp | ⚠️ Parcial | 40% |
| Onboarding restaurante | 🔴 Faltando | 20% |
| Legal (Termos + Privacidade) | ✅ Completo | 100% |
| Multi-unidades | 🔴 Faltando | 0% |

---

*Roadmap sujeito a alterações conforme feedback de clientes e prioridades de negócio.*
