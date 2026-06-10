/**
 * Playbook comercial — sustentar 8–10 novos clientes/mês no Ano 1 (2 founders).
 */

export type GtmCheckItem = { id: string; label: string; hint?: string }
export type GtmBlock = { title: string; intro?: string; items: string[] }
export type GtmFunnelRow = { etapa: string; meta: string; conversao?: string; obs: string }

export const GTM_FUNNEL: GtmFunnelRow[] = [
  { etapa: 'Contatos novos (outbound + inbound)', meta: '80–120 / mês', conversao: '—', obs: '~20/dia útil entre os 2 founders + indicações' },
  { etapa: 'Respostas / leads qualificados', meta: '40–60 / mês', conversao: '~50%', obs: 'Dono/decisor, salão ou balcão, aberto a trocar PDV/cardápio' },
  { etapa: 'Demos / visitas (30–45 min)', meta: '25–35 / mês', conversao: '~60%', obs: 'Demo ao vivo no celular + dashboard; gravar aprendizados' },
  { etapa: 'Propostas / trial acordado', meta: '12–18 / mês', conversao: '~45%', obs: 'Trial 14 dias ou go-live com data marcada' },
  { etapa: 'Fechamentos (go-live)', meta: '8–10 / mês', conversao: '~55%', obs: 'Meta do plano — depende de onboarding não travar' },
]

export const GTM_CAPACITY = {
  implantacaoSalao: { label: 'Salão simples (mesas + cardápio)', dias: '3–4 dias', horas: '~12h' },
  implantacaoMisto: { label: 'Salão + balcão', dias: '5 dias', horas: '~20h' },
  implantacaoComplexo: { label: 'Fila, NF-e ou food hall', dias: '7–10 dias', horas: '~30h' },
  paraleloMax: '6 implantações ao mesmo tempo (3 por founder)',
  regra: 'Se fila de implantação > 2 semanas, pause vendas até liberar — senão churna no onboarding',
  treinamento: '15 min dono + 15 min garçom no dia do go-live (roteiro fixo)',
} as const

/** Páginas com templates completos — /materiais-vendas e /materiais-entrega */
export const GTM_MATERIAIS_LINKS = [
  { href: '/materiais-vendas', label: 'Materiais de vendas' },
  { href: '/materiais-entrega', label: 'Materiais de entrega' },
] as const

export const GTM_CANAIS: GtmBlock[] = [
  {
    title: 'Canais prioritários (Ano 1)',
    intro: 'Ordem de ROI esperado para 2 pessoas sem SDR.',
    items: [
      'Indicação dos 5 pilotos + pedido explícito de 2 indicações cada',
      'Outbound WhatsApp/Instagram: donos de hamburgueria, bistrô, café (raio da sua cidade primeiro)',
      'Contador / consultor gastronômico local (comissão ou fee por fechamento)',
      'Fornecedor de equipamentos (balança, impressora) que já atende o ICP',
      'Grupos de donos de restaurante (participação genuína, não spam)',
      'Inbound leve: Google Meu Negócio KiComanda + 1 post/semana com case real',
    ],
  },
]

export const GTM_ROTINA = [
  { dia: 'Segunda', founder: 'Ambos', foco: 'Planejar semana · 10 contatos outbound cada · revisar pipeline' },
  { dia: 'Ter–Qui', founder: 'Split', foco: 'Manhã: demos + outbound (2h) · Tarde: implantação ou follow-up' },
  { dia: 'Sexta', founder: 'Ambos', foco: 'Review funil (leads → fechamentos) · atualizar cases · prep fim de semana' },
  { dia: 'Métrica semanal', founder: '—', foco: '≥20 contatos · ≥6 demos · ≥2 fechamentos/semana para bater 8–10/mês' },
] as const

export const GTM_GATILHOS_SDR = [
  '3 meses seguidos com ≥ 8 fechamentos/mês e churn < 3%',
  'Founders gastando > 50% do tempo em implantação (não em venda)',
  'Pipeline com > 30 demos agendadas para os próximos 30 dias',
  'Playbook de onboarding documentado e repetível em < 5 dias',
] as const

export const GTM_CHECKLIST_PRE_VENDA: GtmCheckItem[] = [
  { id: 'gtm-1', label: 'ICP definido por escrito', hint: 'Ex.: salão 15–40 mesas, ticket médio R$ 45–80, já usa PIX no balcão' },
  { id: 'gtm-2', label: 'Script de abordagem WhatsApp (3 mensagens)', hint: 'Problema → prova social → convite demo 15 min' },
  { id: 'gtm-3', label: 'Calendly ou agenda compartilhada para demos' },
  { id: 'gtm-4', label: 'CRM mínimo (planilha ou HubSpot free)', hint: 'Colunas: lead, estágio, próximo passo, data' },
  { id: 'gtm-5', label: '2 cases de piloto publicáveis (foto + número)', hint: 'Mesmo que anônimo: "hamburgueria 28 mesas, SP"' },
  { id: 'gtm-6', label: 'Capacidade de implantação mapeada', hint: 'Quantos go-lives cabem em junho sem atrasar?' },
  { id: 'gtm-7', label: 'Trial ou garantia documentada', hint: 'Ex.: 14 dias trial ou devolução se não rodar 1 noite real' },
  { id: 'gtm-8', label: 'Preço e comissão na ponta da língua', hint: '299/399/599 + comissão flat — comparar com maquininha' },
]

export const GTM_SINAIS_ALERTA = [
  'Demos caem mas fechamentos não sobem → problema na proposta/preço ou trial confuso',
  'Fechamentos ok mas churn alto no M2 → onboarding longo ou expectativa errada na venda',
  'Implantação > 7 dias na maioria → simplificar escopo ou pausar vendas',
  'Só um founder vendendo → risco de gargalo; dividir explicitamente SDR-founder / CTO-founder',
] as const
