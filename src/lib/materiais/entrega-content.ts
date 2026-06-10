import type { MateriaisPageContent } from '@/lib/materiais/types'

export const ENTREGA_CONTENT: MateriaisPageContent = {
  slug: 'materiais-entrega',
  title: 'Materiais de Entrega',
  subtitle: 'Onboarding, kickoff, treinamento e go-live · uso interno KiComanda',
  related: [
    { href: '/materiais-vendas', label: '← Materiais de vendas' },
    { href: '/pilotos', label: 'Checklist /pilotos' },
    { href: '/plano-interno', label: 'Plano interno' },
  ],
  sections: [
    {
      id: 'kickoff',
      title: 'Call de kickoff (30 min)',
      intro: 'Agendar no dia seguinte ao fechamento. Gravar notas no CRM.',
      blocks: [
        {
          type: 'list',
          items: [
            '0–5 min — Apresentar cronograma (kickoff → cardápio → config → treino → go-live)',
            '5–15 min — Coletar: CNPJ, endereço, modelo (salão/balcão), chave PIX, quantidade de mesas',
            '15–20 min — Alinhar cardápio: quem envia até quando (template abaixo)',
            '20–25 min — Equipe: quem é garçom/cozinha, celulares, tablet cozinha',
            '25–30 min — Data go-live + grupo WhatsApp suporte + combinar visita se necessário',
          ],
        },
        {
          type: 'text',
          title: 'Mensagem pós-kickoff (WhatsApp)',
          copyable: true,
          body: `Oi, [Nome]! Resumo da nossa kickoff KiComanda:

📅 Go-live: [data]
📋 Envie o cardápio até [data] (planilha ou fotos do menu atual)
👥 Garçons que vão usar o app: [nomes/e-mails]
🍳 Cozinha: tablet/celular com acesso a /cozinha

Próximo passo nosso: cadastro no sistema + configuração inicial.
Qualquer dúvida, responde aqui!`,
        },
      ],
    },
    {
      id: 'coleta',
      title: 'Coleta de dados — checklist',
      blocks: [
        {
          type: 'checklist',
          storageKey: 'kicomanda_materiais_entrega_coleta_v1',
          items: [
            { id: 'e1', label: 'Razão social + nome fantasia', hint: 'Portal /internal/clients/new' },
            { id: 'e2', label: 'CNPJ ou CPF MEI + endereço completo' },
            { id: 'e3', label: 'Slug conferido (URL pública /<slug>)' },
            { id: 'e4', label: 'Modelo operacional: salão · balcão · ambos' },
            { id: 'e5', label: 'Plano + trial/ativo definido' },
            { id: 'e6', label: 'PIX manual ou gateway configurado' },
            { id: 'e7', label: 'Cardápio recebido (categorias, preços, fotos opcionais)' },
            { id: 'e8', label: 'Mapa de mesas (número + seção se houver)' },
            { id: 'e9', label: 'E-mails da equipe + senhas definidas' },
          ],
        },
        {
          type: 'link',
          href: '/internal/clients/new',
          label: 'Abrir portal interno — novo cliente',
          desc: 'Requer login staff (/internal)',
        },
        {
          type: 'link',
          href: '/pilotos',
          label: 'Checklist operacional /pilotos',
        },
      ],
    },
    {
      id: 'cardapio',
      title: 'Template de cardápio (enviar ao cliente)',
      blocks: [
        {
          type: 'text',
          copyable: true,
          body: `PLANILHA DE CARDÁPIO — KiComanda

Instruções: preencha uma linha por item. Envie de volta por WhatsApp ou e-mail.

Categoria (ordem) | Nome do item | Descrição curta | Preço (R$) | Tem álcool? (S/N) | Disponível? (S/N) | Foto (opcional)

Exemplos:
Entradas | Bolinho de bacalhau | 6 unidades crocantes | 32,00 | N | S |
Principais | Picanha 400g | Acompanha arroz e farofa | 89,90 | N | S |
Bebidas | Chopp 500ml | | 12,00 | S | S |

Categorias sugeridas (ajuste ao restaurante):
1. [·]
2. [·]
3. [·]`,
        },
      ],
    },
    {
      id: 'qr',
      title: 'Kit QR — especificação',
      blocks: [
        {
          type: 'list',
          items: [
            'Formato: adesivo A6 (105×148 mm) ou display acrílico na mesa',
            'Conteúdo: logo restaurante + “Escaneie e peça” + QR (URL mesa no dashboard)',
            'Margem de segurança: 5 mm · contraste alto (QR preto em fundo claro)',
            'Teste: escanear de 30 cm com câmera de iPhone/Android médio',
            'Impressão: mínimo 2×2 cm do QR · evitar papel brilhante demais',
            'Após colar: abrir 1 mesa de teste com o dono na hora',
          ],
        },
      ],
    },
    {
      id: 'cronograma',
      title: 'Cronograma tipo — salão simples (3–4 dias)',
      blocks: [
        {
          type: 'table',
          headers: ['Dia', 'Atividade', 'Responsável'],
          rows: [
            ['D0', 'Kickoff + coleta dados', 'Founder + dono'],
            ['D1', 'Cadastro interno + cardápio no sistema', 'KiComanda'],
            ['D2', 'Mesas + QR gerados + PIX configurado', 'KiComanda'],
            ['D3', 'Treino garçom/cozinha + teste ponta a ponta', 'Ambos'],
            ['D4', 'Go-live primeira noite + suporte no WhatsApp', 'KiComanda on-call'],
          ],
        },
      ],
    },
    {
      id: 'garcom',
      title: 'Treinamento garçom (15 min)',
      blocks: [
        {
          type: 'list',
          items: [
            '1. Login — /garcom no Chrome do celular · salvar na tela inicial',
            '2. Ver pedidos — fila por mesa · tocar para ver detalhe · marcar “entregue”',
            '3. Fazer pedido pela mesa — se cliente preferir falar, garçom lança no app',
            '4. Pagamentos — /garcom/pagamentos · confirmar PIX manual ou dinheiro',
            '5. Chamar garçom — banner no topo quando cliente tocar no app · ir à mesa',
            '6. Fechar mesa — após pagamento confirmado · mesa libera no mapa',
          ],
        },
        {
          type: 'text',
          title: 'Script para o founder falar',
          copyable: true,
          body: `"O app é o painel do salão no seu bolso. Quando o cliente pedir pelo QR, o pedido aparece aqui — você só entrega e marca entregue. PIX e dinheiro você confirma em Pagamentos. Se o cliente chamar garçom pelo celular, vibra aqui em cima. Qualquer dúvida na primeira noite, manda no grupo."`,
        },
      ],
    },
    {
      id: 'dono',
      title: 'Treinamento dono — dashboard (15 min)',
      blocks: [
        {
          type: 'list',
          items: [
            'Overview — checklist “Primeiros passos” até 100%',
            'Pedidos — fila em tempo real · status da cozinha',
            'Mesas — mapa · ocupada/livre · QR de cada mesa',
            'Cardápio — editar preço/disponibilidade no dia',
            'Settings → Equipe — cadastrar garçom com senha',
            'Settings → Pagamentos — PIX e forma de recebimento',
            'Settings → Mensalidade — fatura KiComanda (dia 5)',
          ],
        },
      ],
    },
    {
      id: 'cozinha',
      title: 'Cozinha / KDS (5 min)',
      blocks: [
        {
          type: 'list',
          items: [
            'Abrir /cozinha em tablet ou TV com navegador',
            'Pedidos entram automaticamente · avançar: recebido → preparando → pronto',
            'Som/visual: manter tela ligada · carregador fixo',
            'Se impressora no futuro: “Imprimir” no navegador (opcional)',
          ],
        },
      ],
    },
    {
      id: 'pos',
      title: 'Pós go-live',
      blocks: [
        {
          type: 'text',
          title: 'Mensagem D0 (noite do go-live)',
          copyable: true,
          body: `Time [Restaurante], estamos online! 🎉

KiComanda no ar para a noite de hoje. Estamos de plantão até [horário] — qualquer travada, manda áudio no grupo.

Amanhã fazemos um check rápido de 10 min para ver o que ajustar no cardápio ou nas mesas.`,
        },
        {
          type: 'text',
          title: 'Mensagem D+3 (retenção)',
          copyable: true,
          body: `Oi, [Nome]! Como foram os 3 primeiros dias com KiComanda?

3 perguntas rápidas:
1. % de mesas usando QR vs garçom anotando?
2. Algum pedido que não chegou na cozinha?
3. Pagamento (PIX/dinheiro) fluindo ok?

Se estiver tudo certo, podemos pedir uma indicação de outro restaurante — ajuda muito!`,
        },
      ],
    },
    {
      id: 'checklist-entrega',
      title: 'Checklist — entrega completa',
      blocks: [
        {
          type: 'checklist',
          storageKey: 'kicomanda_materiais_entrega_final_v1',
          items: [
            { id: 'f1', label: 'Kickoff realizada + resumo enviado' },
            { id: 'f2', label: 'Cliente criado no portal interno' },
            { id: 'f3', label: 'Cardápio publicado e conferido no celular' },
            { id: 'f4', label: 'QR impresso e testado em 2 mesas' },
            { id: 'f5', label: 'Garçom + cozinha com login e senha' },
            { id: 'f6', label: 'Smoke manual: check-in → pedido → pagamento → fechar' },
            { id: 'f7', label: '/internal/health em 🟢' },
            { id: 'f8', label: 'Go-live com dono avisado + grupo WhatsApp suporte' },
            { id: 'f9', label: 'Follow-up D+3 agendado' },
          ],
        },
        {
          type: 'link',
          href: '/internal/playbook',
          label: 'Playbook completo /internal/playbook',
          desc: 'Implementação e suporte (staff-only)',
        },
      ],
    },
  ],
}
