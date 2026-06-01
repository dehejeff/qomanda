# Plano de Negócio — Qomanda

> Versão 1.0 — Junho 2026  
> Confidencial — uso interno

---

## 1. Sumário Executivo

A **Qomanda** é uma plataforma SaaS de gestão e pagamentos para restaurantes, bares e estabelecimentos de alimentação no Brasil. O produto combina cardápio digital, gestão de mesas, pedidos em tempo real e processamento de pagamentos (PIX, crédito e débito) em uma experiência unificada — sem necessidade de hardware adicional.

O cliente do restaurante acessa o cardápio e paga pelo próprio celular via QR Code. O dono do restaurante gerencia tudo pelo painel web. A Qomanda processa os pagamentos como marketplace, repassando o valor ao restaurante e retendo a taxa da plataforma automaticamente.

**Modelo de receita:** mensalidade SaaS por restaurante + taxa por transação processada via Qomanda Pay.

**Estágio atual:** produto desenvolvido, em fase de validação com primeiros clientes. Lançamento comercial previsto para o 2º semestre de 2026.

---

## 2. Descrição da Empresa

| Item | Detalhe |
|------|---------|
| **Nome** | Qomanda |
| **Tipo jurídico** | SLU ou LTDA (a definir) |
| **CNAE principal** | 6204-0/00 — Consultoria em TI |
| **CNAEs secundários** | 6202-3/00 (desenvolvimento de software), 6619-3/99 (serviços financeiros auxiliares) |
| **Sede** | Rio de Janeiro, RJ |
| **Website** | qomanda.com.br |
| **Fundador** | Jefferson Brito |
| **Contato** | jeff@qomanda.com |

### Missão

Simplificar a operação de restaurantes com tecnologia acessível, eliminando filas, erros de pedido e perda de receita por processos manuais.

### Visão

Ser a principal plataforma de gestão e pagamentos para restaurantes independentes no Brasil até 2028.

### Valores

- Simplicidade: produto fácil de usar para donos, garçons e clientes
- Confiabilidade: sistema disponível 24/7, pagamentos seguros
- Transparência: taxas claras, sem surpresas
- Crescimento compartilhado: sucesso do restaurante = sucesso da Qomanda

---

## 3. Produto

### 3.1 O Problema

Restaurantes independentes enfrentam três problemas operacionais crônicos:

1. **Atendimento lento e pedidos errados** — comanda manual, garçons sobrecarregados, erros de digitação
2. **Pagamento travado** — cliente espera 10–15 min para fechar a conta; maquininhas com taxas opacas
3. **Falta de dados** — sem histórico de clientes, sem análise de cardápio, sem controle de receita em tempo real

### 3.2 A Solução

A Qomanda entrega três superfícies integradas:

#### Cliente (PWA — sem instalação)
- Check-in por QR Code na mesa
- Cardápio digital com fotos, categorias e promoções
- Pedido direto pelo celular com acompanhamento em tempo real
- Pagamento: PIX, crédito, débito ou dinheiro
- Programa de fidelidade automático
- Histórico de visitas e recibos no hub do cliente

#### Restaurante (Dashboard web)
- Mapa de mesas em tempo real
- Fila de pedidos (kanban: pendente → preparando → entregue)
- Confirmação de pagamento em dinheiro
- Gestão de cardápio (fotos, preços, promoções, sugestão do chef)
- Histórico de transações e exportação CSV
- Configurações: fidelidade, integrações, conta bancária de repasse

#### Qomanda (Portal interno)
- KPIs da plataforma (MRR, GMV, clientes ativos)
- Gestão de clientes, planos e assinaturas
- Gateway Pay (configuração Asaas master)
- Suporte com fila de tickets

### 3.3 Tecnologia

| Componente | Tecnologia |
|-----------|-----------|
| Frontend | Next.js 16 (App Router, TypeScript) |
| Banco de dados | Supabase (PostgreSQL + Auth + Realtime) |
| Pagamentos | Asaas (marketplace/split, PIX, crédito, débito) |
| Hospedagem | Vercel (Edge Network) |
| NF-e | Focus NFe |
| WhatsApp | Meta Business API |
| Criptografia | AES-256-GCM (CPF, API keys) |

### 3.4 Diferenciais Competitivos

- **Sem hardware:** funciona 100% no celular do cliente, sem totem nem maquininha exclusiva
- **Split automático:** Qomanda Pay repassa o valor ao restaurante na mesma transação, sem conciliação manual
- **Fidelidade integrada:** contagem de visitas e benefícios automáticos sem app separado
- **Tempo real:** pedidos e status de mesa sincronizados instantaneamente via Supabase Realtime
- **NF-e automática:** emissão e envio por WhatsApp após pagamento (em desenvolvimento)

---

## 4. Mercado

### 4.1 Tamanho de Mercado

| Segmento | Números |
|---------|---------|
| Estabelecimentos de alimentação no Brasil | ~1,2 milhão |
| Restaurantes com 5+ mesas (mercado endereçável) | ~300.000 |
| Restaurantes independentes sem sistema digital | ~200.000 |
| TAM estimado (R$ 150/mês × 300k restaurantes) | **R$ 540M/ano** |
| SAM (independentes, cidades médias+) | ~R$ 150M/ano |
| SOM — 3 anos (1% do SAM) | **R$ 1,5M ARR** |

### 4.2 Segmento-Alvo

**Primário:** Restaurantes independentes de médio porte (20–100 mesas), bares, botecos e casas de comida em capitais e cidades médias brasileiras.

**Perfil do cliente ideal:**
- Faturamento mensal entre R$ 30.000 e R$ 300.000
- Dono que já usa WhatsApp no negócio mas ainda opera com comanda de papel
- Sem sistema de PDV ou insatisfeito com o atual
- Quer reduzir custo de maquininha e melhorar fluxo de caixa

**Secundário:** Redes pequenas (2–5 unidades), food parks, dark kitchens com atendimento presencial.

### 4.3 Análise Competitiva

| Solução | Tipo | Fraqueza vs Qomanda |
|---------|------|---------------------|
| iFood / Rappi | Delivery | Não resolve mesa presencial; comissão alta (12–30%) |
| Totem / MenuDig | Cardápio digital | Não processa pagamento; sem gestão de pedidos |
| Ifood POS / Linx | PDV completo | Caro (R$ 500+/mês), complexo, exige hardware |
| GetNinjas / Aiqfome | Marketplace local | Não é SaaS de gestão |
| Maquininha (Stone/Cielo) | Pagamento isolado | Sem cardápio nem gestão de pedidos |

**Posicionamento:** Qomanda ocupa o espaço entre o cardápio digital simples (sem pagamento) e o PDV completo (caro demais para independentes). É a solução **tudo-em-um acessível** para o restaurante de bairro.

---

## 5. Modelo de Receita

### 5.1 Planos SaaS (Mensalidade)

| Plano | Preço/mês | Perfil |
|-------|-----------|--------|
| **Starter** | R$ 99 | Até 10 mesas, funcionalidades básicas |
| **Growth** | R$ 199 | Até 30 mesas, fidelidade, WhatsApp |
| **Pro** | R$ 349 | Mesas ilimitadas, NF-e, analytics |
| **Enterprise** | Customizado | Redes, multi-unidades, SLA dedicado |

Todos os planos incluem **30 dias de trial gratuito**.

### 5.2 Taxa por Transação (Qomanda Pay)

Sobre cada pagamento processado via PIX, crédito ou débito:

| Componente | Valor |
|-----------|-------|
| Taxa percentual | 1,5% a 3,5% (por plano) |
| Taxa fixa | R$ 0,30 por transação |

O repasse ao restaurante é feito automaticamente via split do Asaas. A Qomanda retém sua parte na conta master.

### 5.3 Projeção de Receita (Cenário Base)

| Mês | Restaurantes ativos | MRR Planos | GMV Pay | Receita Pay (2,5%) | **Receita Total** |
|-----|--------------------|-----------|---------|--------------------|-------------------|
| 3 | 10 | R$ 1.990 | R$ 50.000 | R$ 1.250 | **R$ 3.240** |
| 6 | 30 | R$ 5.970 | R$ 180.000 | R$ 4.500 | **R$ 10.470** |
| 12 | 80 | R$ 15.920 | R$ 600.000 | R$ 15.000 | **R$ 30.920** |
| 18 | 180 | R$ 35.820 | R$ 1.500.000 | R$ 37.500 | **R$ 73.320** |
| 24 | 350 | R$ 69.650 | R$ 3.200.000 | R$ 80.000 | **R$ 149.650** |

> GMV estimado de R$ 7.500/mês por restaurante (ticket médio R$ 75 × 100 mesas/mês).

### 5.4 Unit Economics

| Métrica | Valor estimado |
|---------|---------------|
| **ARPU** (receita média por restaurante) | R$ 380/mês (plano + taxa) |
| **Churn mensal alvo** | < 3% |
| **LTV** (24 meses) | R$ 9.120 |
| **CAC alvo** | < R$ 800 |
| **LTV/CAC** | > 11x |
| **Payback period** | ~3 meses |

---

## 6. Estratégia de Marketing e Vendas

### 6.1 Go-to-Market

**Fase 1 — Validação (meses 1–3):**
- 5–10 restaurantes piloto em Rio de Janeiro (clientes próximos, sem custo de aquisição)
- Feedback intensivo, ajustes de produto
- Construção de casos de sucesso e depoimentos

**Fase 2 — Tração (meses 4–12):**
- Vendas diretas por WhatsApp e visitas presenciais
- Indicação: programa de comissão para garçons e consultores de gastronomia
- Conteúdo no Instagram/TikTok mostrando o produto em uso real
- Parcerias com fornecedores de insumos e associações de bares e restaurantes (ABRASEL)

**Fase 3 — Escala (ano 2+):**
- SDR dedicado para prospecção ativa
- Google Ads focado em "sistema para restaurante"
- Revendedores regionais com comissão recorrente

### 6.2 Canal de Aquisição Prioritário

O maior diferencial de aquisição é o **efeito viral do próprio produto**: cada cliente que usa o QR Code no restaurante vê a marca Qomanda na tela. Clientes que curtirem a experiência viram promotores espontâneos.

### 6.3 Retenção

- Onboarding assistido (chamada de 30 min para configuração inicial)
- Suporte via ticket no portal (já implementado)
- NPS trimestral
- Updates de produto com novos recursos

---

## 7. Operações

### 7.1 Infraestrutura

- **Vercel** (hosting): escala automática, zero ops, ~R$ 200/mês até 100 clientes
- **Supabase** (banco): R$ 25/mês (Pro plan) — suporta até ~500 restaurantes ativos
- **Asaas** (pagamentos): sem custo fixo, taxa por transação já embutida no modelo
- **Total infra estimado:** R$ 300–500/mês nos primeiros 12 meses

### 7.2 Equipe Inicial

| Papel | Perfil | Custo estimado |
|-------|--------|----------------|
| **CTO / Dev** | Jefferson Brito (fundador) | — |
| **Comercial / CS** | 1 pessoa, mês 3–6 | R$ 3.000–4.000/mês |
| **Designer / Marketing** | Freelancer | R$ 1.500–2.500/mês |

Escala para time completo após R$ 50k MRR.

### 7.3 Processos Críticos

- **Onboarding de restaurante:** < 48h da contratação até primeiro pedido
- **Suporte:** resposta em < 4h em horário comercial
- **Pagamentos:** repasse automático via Asaas, conciliação diária
- **Uptime alvo:** 99,5% (Vercel + Supabase garantem isso com SLA)

---

## 8. Plano Financeiro

### 8.1 Investimento Inicial Necessário

| Item | Valor |
|------|-------|
| Abertura de empresa (CNPJ, contador) | R$ 1.500 |
| Domínio, certificados, infra inicial | R$ 500 |
| Marketing inicial (materiais, ads) | R$ 3.000 |
| Capital de giro (6 meses ops) | R$ 10.000 |
| **Total** | **R$ 15.000** |

> O produto já está desenvolvido — sem custo de desenvolvimento inicial.

### 8.2 Ponto de Equilíbrio

Com custo fixo mensal de ~R$ 5.000 (infra + parte do comercial) e ARPU de R$ 380:

**Break-even: ~14 restaurantes ativos pagantes**

Meta para o mês 6: 30 restaurantes → já positivo.

### 8.3 Projeção de Fluxo de Caixa (Ano 1)

| Trimestre | Receita | Custos | **Resultado** |
|-----------|---------|--------|---------------|
| T1 | R$ 5.000 | R$ 12.000 | -R$ 7.000 |
| T2 | R$ 18.000 | R$ 15.000 | **+R$ 3.000** |
| T3 | R$ 45.000 | R$ 20.000 | **+R$ 25.000** |
| T4 | R$ 90.000 | R$ 28.000 | **+R$ 62.000** |

---

## 9. Roadmap de Produto

### Fase 1 — Lançamento (Jun–Set 2026)
- [ ] Qomanda Pay em produção (marketplace Asaas aprovado)
- [ ] NF-e automática ao cliente
- [ ] Cobrança automática de mensalidade
- [ ] Webhook robusto com retry e idempotência

### Fase 2 — Crescimento (Q3–Q4 2026)
- [ ] App Garçom (mobile-first)
- [ ] Analytics avançado (receita por período, ranking de pratos)
- [ ] WhatsApp Business — confirmação de pedido e campanhas
- [ ] 2FA e histórico de sessões

### Fase 3 — Escala (2027)
- [ ] Multi-unidades
- [ ] Impressora de cozinha (Epson/Bixolon)
- [ ] PWA instalável
- [ ] API pública para integrações

---

## 10. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Asaas não aprova marketplace | Média | Alto | Já identificado; contato ativo com suporte Asaas; plano B: integração direta com Pagar.me |
| Churn alto por dificuldade de uso | Média | Alto | Onboarding assistido, UX simples, suporte rápido |
| Concorrente grande entra no segmento | Baixa | Médio | Velocidade de iteração + relacionamento próximo com clientes |
| Indisponibilidade de infra (Supabase/Vercel) | Baixa | Alto | SLA contratual + monitoramento + plano de contingência |
| Inadimplência de restaurantes | Média | Médio | Cobrança automática via Asaas; bloqueio automático após X dias |
| Fraude em pagamentos | Baixa | Alto | Asaas gerencia antifraude; PIN de 6 dígitos para cartões salvos; CPF criptografado |

---

## 11. Aspectos Jurídicos e Regulatórios

- **LGPD:** dados de clientes (CPF, WhatsApp) coletados com consentimento; CPF armazenado criptografado (AES-256-GCM); política de privacidade publicada
- **PCI-DSS:** dados de cartão processados pelo Asaas (certificado PCI nível 1); Qomanda não armazena dados de cartão em texto puro
- **NF-e:** emissão via Focus NFe, homologado pela SEFAZ; restaurante precisa de certificado digital A1
- **Marketplace financeiro:** operação como facilitador de pagamento via Asaas; não é instituição de pagamento, não requer autorização do Banco Central
- **Termos de Uso e Política de Privacidade:** publicados em qomanda.com.br

---

## 12. Próximos Passos Imediatos

| Prioridade | Ação | Prazo |
|-----------|------|-------|
| 🔴 | Abrir CNPJ (SLU ou LTDA) | Jul 2026 |
| 🔴 | Criar conta Asaas produção (CNPJ) e solicitar marketplace | Jul 2026 |
| 🔴 | Implantar Qomanda Pay em produção | Ago 2026 |
| 🔴 | Primeiros 5 restaurantes piloto pagantes | Ago 2026 |
| 🟠 | NF-e automática funcionando | Set 2026 |
| 🟠 | Cobrança automática de mensalidade | Set 2026 |
| 🟡 | 30 restaurantes ativos | Out 2026 |
| 🟡 | Contratar comercial/CS | Out 2026 |

---

*Documento elaborado com base no produto desenvolvido e no contexto de mercado. Projeções financeiras são estimativas sujeitas a revisão conforme validação com clientes reais.*
