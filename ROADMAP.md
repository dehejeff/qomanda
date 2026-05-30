# Qomanda — Roadmap

> Última atualização: 2026-05-30

---

## ✅ MVP — Implementado

### Plataforma Cliente (PWA)
- [x] Scanner de QR Code (BarcodeDetector API + fallback manual)
- [x] Check-in com captura de nome, sobrenome e WhatsApp
- [x] Identificação única de cliente por WhatsApp (upsert)
- [x] Home hub pós check-in com status de pedido em tempo real
- [x] Cardápio digital com categorias, fotos e filtros
- [x] Pedidos direto do celular com carrinho e stepper de quantidade
- [x] Acompanhamento de pedidos com barra de progresso animada
- [x] Checkout com divisão de conta automática
- [x] Telas de pagamento: PIX (UI + countdown), Débito, Crédito (formulário + parcelas)
- [x] Tela de confirmação com código de validação
- [x] Perfil do cliente com edição de dados e preferências
- [x] Programa de fidelidade (contagem de visitas + próxima recompensa)
- [x] Bottom nav com 5 tabs (Início, Cardápio, Pedidos, Pagamento, Perfil)

### Painel Administrativo (Dashboard)
- [x] Login com autenticação Supabase
- [x] Overview em tempo real (mesas ocupadas, pedidos abertos, receita do dia)
- [x] Mapa de mesas com status (livre/ocupada/reservada)
- [x] Geração de QR Code por mesa
- [x] Gestão de cardápio (categorias + itens + toggle de disponibilidade)
- [x] Fila de pedidos (kanban: pendente → confirmado → preparando → pronto → entregue)
- [x] Settings: aba Pagamentos com histórico de transações
- [x] Settings: aba Fidelidade (configurar regras visitas → benefício)
- [x] Sidebar com navegação e logo

### Infraestrutura
- [x] Schema Supabase completo (11 tabelas com RLS e triggers)
- [x] Realtime subscriptions (orders, sessions)
- [x] Stripe webhook (payment_intent.succeeded)
- [x] Modo dev com mock data (DEV_BYPASS)
- [x] Tipagem TypeScript completa
- [x] Landing page de marketing com pricing e comparativo de mercado

---

## 🔴 Fase 1 — Lançamento (Prioridade Alta)

> Bloqueadores para ir a produção com clientes reais.

### Pagamentos
- [ ] **Stripe PIX real** — geração de QR Code via Stripe e polling de status
- [ ] **Stripe Débito** — fluxo completo de débito (atualmente UI only)
- [ ] **Stripe Crédito com parcelamento** — lógica de parcelamento no backend
- [ ] **Webhook robusto** — retry, idempotência e logs de erro

### Onboarding do Restaurante
- [ ] **Fluxo de cadastro do restaurante** — tela de sign-up pública para novos clientes
- [ ] **Wizard de configuração inicial** — nome, logo, endereço, horários
- [ ] **Upload de logo e fotos de itens** — Supabase Storage

### Fidelidade (Persistência)
- [ ] **Salvar regras de fidelidade no Supabase** — settings → loyalty_rules (atualmente UI only)
- [ ] **Exibir benefício conquistado para o garçom** — alerta no dashboard quando cliente atinge meta

### Outros
- [ ] **Chamar Garçom** — botão no home do cliente envia notificação para o dashboard
- [ ] **Upload de imagem de item do cardápio** — formulário de adição com Supabase Storage

---

## 🟡 Fase 2 — Crescimento (Q3 2026)

### Analytics
- [ ] Gráfico de receita por período (diário/semanal/mensal)
- [ ] Ranking de pratos mais pedidos
- [ ] Análise de horário de pico
- [ ] Ticket médio por mesa e por cliente
- [ ] Exportação de relatórios (CSV/PDF)

### Equipe & Permissões
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
- [ ] Reembolsos e disputas no painel (Stripe Refunds API)
- [ ] Liquidação/reconciliação financeira mensal

---

## 📊 Status Resumido

| Área | Status | % Completo |
|---|---|---|
| Cliente — Fluxo principal | ✅ Completo | 95% |
| Cliente — Pagamento | ⚠️ Parcial | 60% |
| Dashboard — Operação | ✅ Completo | 90% |
| Dashboard — Analytics | 🔴 Faltando | 10% |
| Dashboard — Equipe/Segurança | 🔴 Faltando | 0% |
| Pagamentos (Stripe) | ⚠️ Parcial | 50% |
| Fidelidade | ⚠️ Parcial | 70% |
| WhatsApp | 🔴 Faltando | 0% |
| Onboarding restaurante | 🔴 Faltando | 20% |
| Multi-unidades | 🔴 Faltando | 0% |

---

*Roadmap sujeito a alterações conforme feedback de clientes e prioridades de negócio.*
