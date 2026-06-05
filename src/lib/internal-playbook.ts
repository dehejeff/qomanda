/**
 * Playbook interno — Implementação e Suporte.
 * Conteúdo de referência para o time configurar novos restaurantes/bares e
 * dar suporte. Renderizado em /internal/playbook (página escondida, staff-only).
 */

export type PlaybookItem = { text: string; hint?: string }
export type PlaybookSection = { id: string; title: string; intro?: string; items: PlaybookItem[] }
export type PlaybookPart = { id: string; title: string; subtitle: string; icon: string; sections: PlaybookSection[] }

export const PLAYBOOK: PlaybookPart[] = [
  // ====================================================================
  {
    id: 'impl',
    title: 'Implementação — onboarding de novo cliente',
    subtitle: 'Do primeiro contato ao go-live. Siga na ordem.',
    icon: 'rocket_launch',
    sections: [
      {
        id: 'impl-coleta',
        title: '1. Coleta de dados (antes de configurar)',
        intro: 'Reúna tudo do cliente para não travar no meio.',
        items: [
          { text: 'Razão social + nome fantasia' },
          { text: 'CNPJ (ou CPF do MEI/autônomo) e regime tributário' },
          { text: 'Endereço completo (CEP — o sistema preenche via ViaCEP)' },
          { text: 'E-mail comercial e telefone/WhatsApp de contato' },
          { text: 'Modelo de operação: salão (mesas), balcão (número) ou ambos', hint: 'Define o fluxo do cliente e o painel.' },
          { text: 'Forma de recebimento desejada: PIX manual, Asaas ou Mercado Pago' },
          { text: 'Dados bancários / chave PIX do recebimento' },
          { text: 'Cardápio (categorias, itens, preços, fotos) e itens com álcool' },
          { text: 'Precisa emitir NF-e pela Qomanda? Se já usa PDV/SAT, NF-e é opcional' },
          { text: 'Plano contratado (Starter/Growth/Pro) e eventuais taxas custom' },
        ],
      },
      {
        id: 'impl-criar',
        title: '2. Criar o cliente no portal interno',
        intro: '/internal/clients/new — cadastro com abas.',
        items: [
          { text: 'Aba Estabelecimento: modelo operacional + razão social, CNPJ, endereço, contato' },
          { text: 'Aba Plano Qomanda: plano, status da assinatura (trial/ativo), taxas custom se houver' },
          { text: 'Conferir que o slug ficou correto (vira a URL pública /<slug>)' },
          { text: 'Salvar — o sistema provisiona assinatura/trial automaticamente' },
        ],
      },
      {
        id: 'impl-pagamento',
        title: '3. Forma de recebimento',
        intro: 'Settings → Pagamentos (ou na aba do cliente). Os pagamentos caem 100% na conta do restaurante.',
        items: [
          { text: 'PIX manual: informar tipo de chave + chave + nome do titular — funciona na hora, sem gateway' },
          { text: 'Asaas: colar a API key da conta do restaurante e testar conexão' },
          { text: 'Mercado Pago: "Conectar com Mercado Pago" (OAuth) ou colar access token manual' },
          { text: 'Dinheiro está sempre disponível (sem comissão), confirmado pelo garçom' },
          { text: 'Definir o modo operacional aqui também (salão/balcão/ambos)' },
        ],
      },
      {
        id: 'impl-cardapio',
        title: '4. Cardápio',
        intro: 'Dashboard → Cardápio.',
        items: [
          { text: 'Criar categorias na ordem de exibição desejada' },
          { text: 'Adicionar itens: nome, descrição, preço, foto (upload), disponível' },
          { text: 'Marcar itens com álcool (split de recibo) e "sugestão do chef" se aplicável' },
          { text: 'Cadastrar promoções (preço promocional) quando houver' },
          { text: 'Conferir o cardápio na visão do cliente (/<slug> via QR ou link)' },
        ],
      },
      {
        id: 'impl-mesas',
        title: '5. Mesas e QR codes (salão) / Balcão',
        items: [
          { text: 'Salão: criar as mesas no Mapa de Mesas (Dashboard → Mesas)' },
          { text: 'Gerar e imprimir o QR code de cada mesa (adesivo/display)' },
          { text: 'Balcão: validar o fluxo por número de pedido (sem mesa)' },
          { text: 'Testar um check-in real escaneando o QR' },
        ],
      },
      {
        id: 'impl-nfe',
        title: '6. NF-e (opcional)',
        intro: 'Só se a Qomanda for emitir. Caso contrário, pular.',
        items: [
          { text: 'Definir o tipo de nota por restaurante (NFC-e modelo 65 ou NFS-e)' },
          { text: 'Sem credenciais Focus NFe → roda em modo SIMULADO (testável, não vale fiscalmente)' },
          { text: 'Para emissão real: cadastrar token/empresa Focus NFe + dados fiscais (CNAE, série, regime)' },
          { text: 'WhatsApp de envio da nota ao cliente: configurar em Settings → Integrações' },
        ],
      },
      {
        id: 'impl-equipe',
        title: '7. Equipe (garçom / cozinha)',
        intro: 'Settings → Equipe.',
        items: [
          { text: 'Adicionar cada garçom/cozinha pelo e-mail + DEFINIR SENHA (sem senha não loga)' },
          { text: 'App do garçom: /garcom ou /login?perfil=garcom no celular' },
          { text: 'Ensinar: fila de pedidos, confirmar PIX/dinheiro, fazer pedido pela mesa, fechar conta, atender chamado' },
          { text: 'Inativar contas de ex-funcionários quando necessário' },
        ],
      },
      {
        id: 'impl-fidelidade',
        title: '8. Fidelidade (opcional)',
        items: [
          { text: 'Settings → Fidelidade: criar regras (ex.: 5 visitas = brinde)' },
          { text: 'Explicar ao garçom onde aparece o benefício do cliente' },
        ],
      },
      {
        id: 'impl-aceite',
        title: '9. Teste de aceitação (antes de liberar)',
        intro: 'Rodar o fluxo completo com o cliente.',
        items: [
          { text: 'Check-in (QR/balcão) → ver cardápio → fazer pedido' },
          { text: 'Pedido aparece na fila do dashboard e do garçom; mudar status até entregue' },
          { text: 'Fechar conta: pagamento (PIX manual/dinheiro) confirmado' },
          { text: 'Conferir recibo do cliente e (se ativo) a NF-e' },
          { text: 'Testar "Chamar Garçom" → alerta no app do garçom e sino do dashboard' },
          { text: 'Conferir o painel Saúde (/internal/health) sem erros' },
        ],
      },
      {
        id: 'impl-treino',
        title: '10. Treinamento e entrega',
        items: [
          { text: 'Treinar o dono: dashboard (pedidos, mesas, cardápio, analytics, mensalidade)' },
          { text: 'Treinar os garçons no app /garcom' },
          { text: 'Explicar a mensalidade (cobrança dia 5) e onde ver as faturas' },
          { text: 'Deixar canais de suporte e o material de QR impresso' },
        ],
      },
    ],
  },
  // ====================================================================
  {
    id: 'sup',
    title: 'Suporte — operação contínua',
    subtitle: 'Diagnóstico e procedimentos para problemas do dia a dia.',
    icon: 'support_agent',
    sections: [
      {
        id: 'sup-primeiro',
        title: 'Onde olhar primeiro',
        items: [
          { text: 'Painel Saúde (/internal/health): status geral, fila, webhooks, NF-e em erro, atraso' },
          { text: 'Overview (/internal): banner de saúde + fila "Requer atenção" + tickets' },
          { text: 'Cobrança (/internal/billing): status das mensalidades por cliente' },
          { text: 'Sentry (quando configurado): stack traces e alertas de 5xx' },
        ],
      },
      {
        id: 'sup-pagamento',
        title: 'Pagamento não confirmou',
        items: [
          { text: 'PIX/cartão (Asaas/MP): confirmação vem por webhook — checar webhook_events por erro' },
          { text: 'Confirmar que a URL do webhook está cadastrada no gateway e o token bate' },
          { text: 'PIX manual/dinheiro: o garçom precisa confirmar manualmente em /garcom/pagamentos' },
          { text: 'Reenvio de webhook é idempotente (dedupe por provider+event_id) — pode reenviar sem duplicar' },
        ],
      },
      {
        id: 'sup-nfe',
        title: 'NF-e não saiu',
        items: [
          { text: 'A emissão é assíncrona (fila). Ver async_jobs do tipo nfe_emit (status/erro)' },
          { text: 'Sem credenciais Focus → status "simulated" é o esperado (não é erro)' },
          { text: 'Restaurante precisa estar com nfe_enabled + nfe_auto_emit + nfe_status=active + tipo definido' },
          { text: 'Forçar processamento: POST /api/cron/process-jobs (com CRON_SECRET)' },
          { text: 'NF-e em "error": ver error_message em nfe_invoices; corrigir cadastro fiscal e reemitir' },
        ],
      },
      {
        id: 'sup-whatsapp',
        title: 'WhatsApp não enviou',
        items: [
          { text: 'Envio é enfileirado (job whatsapp_send) com throttle por restaurante (20/min)' },
          { text: 'Sem credenciais WhatsApp Business → em dev é mock; em prod precisa phone_id + token' },
          { text: 'Conferir async_jobs whatsapp_send (deferred = throttle; error = falha de envio)' },
          { text: 'whatsapp_nfe_enabled precisa estar ligado para enviar a nota ao cliente' },
        ],
      },
      {
        id: 'sup-garcom',
        title: 'Garçom não consegue logar',
        items: [
          { text: 'Causa #1: conta sem senha — Settings → Equipe → "Definir senha"' },
          { text: 'Conta inativada: reativar em Settings → Equipe' },
          { text: 'Garçom usa o e-mail cadastrado + senha em /login?perfil=garcom' },
        ],
      },
      {
        id: 'sup-realtime',
        title: '"Chamar Garçom" / sino não chega em tempo real',
        items: [
          { text: 'Exige a tabela na publicação supabase_realtime (migrate-realtime-notifications.sql)' },
          { text: 'O chamado fica registrado em restaurant_notifications mesmo que o realtime falhe' },
          { text: 'Throttle: chamados repetidos não-atendidos em <25s são agrupados (proposital)' },
        ],
      },
      {
        id: 'sup-mesa',
        title: 'Mesa travada / sessão não fecha',
        items: [
          { text: 'Sessão em "closing" sem consumo pode travar a mesa — verificar pagamentos da sessão' },
          { text: 'Status da mesa é dirigido por trigger a partir do status da sessão' },
          { text: 'Conferir se há saldo pendente (pagamento parcial) antes de fechar' },
        ],
      },
      {
        id: 'sup-cobranca',
        title: 'Mensalidade em atraso / cobrança',
        items: [
          { text: '/internal/billing mostra atraso (com dias) por cliente' },
          { text: 'Emitir boleto/PIX: botão na linha do cliente (gera cobrança Asaas)' },
          { text: 'Marcar paga manualmente concilia + dispara a NF-e de serviço' },
          { text: 'Lembrete automático de atraso roda diariamente (1x/dia por fatura)' },
          { text: 'Exportar CSV das faturas para conferência' },
        ],
      },
      {
        id: 'sup-proc',
        title: 'Procedimentos rápidos',
        items: [
          { text: 'Reprocessar a fila: POST /api/cron/process-jobs (Authorization: Bearer CRON_SECRET)' },
          { text: 'Reemitir NF-e do pagamento: POST /api/dashboard/nfe/emit (como dono)' },
          { text: 'Reenviar NF-e por WhatsApp: POST /api/dashboard/nfe/resend' },
          { text: 'Resetar senha do garçom: Settings → Equipe → Trocar senha' },
          { text: 'Conferir saúde após qualquer ação: /internal/health' },
        ],
      },
      {
        id: 'sup-escala',
        title: 'Quando escalar para o time de produto/dev',
        items: [
          { text: 'Erro recorrente de webhook ou fila travada (oldest pending alto) no painel Saúde' },
          { text: 'NF-e em "error" por motivo não-fiscal (ex.: exceção do sistema)' },
          { text: 'Pagamento confirmado no gateway mas não refletido após reenvio do webhook' },
          { text: 'Abrir ticket com: slug do restaurante, horário, IDs envolvidos e print do Saúde' },
        ],
      },
    ],
  },
]
