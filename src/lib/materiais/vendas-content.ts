import type { MateriaisPageContent } from '@/lib/materiais/types'

export const VENDAS_CONTENT: MateriaisPageContent = {
  slug: 'materiais-vendas',
  title: 'Materiais de Vendas',
  subtitle: 'Templates prontos para outbound, demo e fechamento · uso interno KiComanda',
  related: [
    { href: '/materiais-entrega', label: 'Materiais de entrega →' },
    { href: '/plano-interno', label: 'Plano interno · Motor Comercial' },
    { href: '/pilotos', label: 'Checklist pilotos' },
  ],
  sections: [
    {
      id: 'deck',
      title: 'Pitch deck — 10 slides',
      intro: 'Montar no Google Slides ou Canva. Uma ideia por slide; demo ao vivo no slide 5.',
      blocks: [
        {
          type: 'list',
          items: [
            '1. Capa — KiComanda · pedido na mesa sem app para o cliente',
            '2. Problema — garçom sobrecarregado, erro no pedido, fila no caixa, maquininha cara',
            '3. Quem somos — SaaS feito para restaurante brasileiro (salão, balcão, fila)',
            '4. Como funciona — QR na mesa → cardápio → pedido → cozinha → pagamento na conta do restaurante',
            '5. Demo ao vivo — escanear QR, pedir 1 item, mostrar cozinha + garçom (3 min)',
            '6. Diferencial — dinheiro 100% na conta do dono; comissão menor que maquininha; sem taxa de gateway',
            '7. Planos — Starter R$299 · Growth R$399 · Pro R$599 + comissão flat sobre vendas digitais',
            '8. Case piloto — foto QR + número (“28 mesas, +X pedidos/noite”) + depoimento 1 frase',
            '9. Implantação — 3–5 dias, treinamento 30 min, trial 14 dias ou 1ª noite garantida',
            '10. Próximo passo — data de kickoff + WhatsApp do decisor',
          ],
        },
      ],
    },
    {
      id: 'onepager',
      title: 'One-pager (WhatsApp / PDF)',
      blocks: [
        {
          type: 'text',
          title: 'Texto para colar no WhatsApp',
          copyable: true,
          body: `KiComanda — sistema de pedido na mesa para restaurantes

O cliente escaneia o QR, vê o cardápio e pede pelo celular. O pedido cai na cozinha e no app do garçom em tempo real. Pagamento PIX, cartão ou dinheiro — o valor cai 100% na sua conta.

✓ Menos erro de pedido e menos fila no caixa
✓ Comissão sobre venda digital menor que a taxa da maquininha
✓ Implantação em poucos dias + treinamento com a equipe

Planos a partir de R$ 299/mês. Trial de 14 dias.

Quer ver uma demo de 15 min esta semana?`,
        },
      ],
    },
    {
      id: 'whatsapp',
      title: 'Scripts WhatsApp — outbound',
      blocks: [
        {
          type: 'text',
          title: 'Mensagem 1 — primeiro contato',
          copyable: true,
          body: `Oi, [Nome]! Sou [Seu nome] da KiComanda — a gente ajuda restaurantes a receber pedido direto na mesa pelo QR, sem o cliente baixar app.

Vi o [nome do restaurante] e achei que combina com o movimento de vocês. Posso te mostrar em 15 min como funciona na prática?`,
        },
        {
          type: 'text',
          title: 'Mensagem 2 — se não responder (D+2)',
          copyable: true,
          body: `[Nome], só passando de novo — restaurantes parecidos com o seu usam KiComanda para o garçom não precisar anotar pedido no papel e a cozinha ver tudo em tempo real.

Se fizer sentido, te mando um vídeo de 1 min ou marcamos uma call rápida.`,
        },
        {
          type: 'text',
          title: 'Mensagem 3 — pós-demo (fechamento)',
          copyable: true,
          body: `[Nome], obrigado pela demo hoje!

Resumo do que combinamos:
• Plano [Starter/Growth/Pro] — R$ [299/399/599]/mês
• Go-live alvo: [data]
• Próximo passo: call de kickoff de 30 min + envio do cardápio

Confirmo a data e te mando o link da kickoff?`,
        },
      ],
    },
    {
      id: 'demo',
      title: 'Roteiro vídeo demo (3 min)',
      blocks: [
        {
          type: 'list',
          items: [
            '0:00 — QR na mesa (close) + cliente abre cardápio',
            '0:30 — Adiciona 2 itens, observação “sem cebola”',
            '1:00 — Tela cozinha (/cozinha) recebe pedido · muda status',
            '1:30 — App garçom (/garcom) · marca entregue',
            '2:00 — Cliente “Chamar Garçom” · sino no dashboard',
            '2:30 — Fechar conta · PIX manual confirmado',
            '2:50 — CTA: “Agende sua demo” + logo KiComanda',
          ],
        },
      ],
    },
    {
      id: 'cases',
      title: 'Template de case (piloto)',
      blocks: [
        {
          type: 'text',
          title: 'Estrutura para preencher após cada piloto',
          copyable: true,
          body: `Case: [Nome fantasia ou “Hamburgueria · Zona Sul”]
Mesas: [N] · Modelo: [salão / balcão / ambos]
Antes: [ex.: garçom anotava no bloco, 2 erros/noite]
Depois: [ex.: 80% dos pedidos pelo QR na 1ª semana]
Número: [ex.: tempo médio do pedido −X min, ou +Y pedidos/noite]
Depoimento (1 frase do dono): “...”
Foto: QR na mesa + print dashboard (pedidos ao vivo)`,
        },
      ],
    },
    {
      id: 'planos',
      title: 'Tabela de planos + comissão',
      blocks: [
        {
          type: 'table',
          headers: ['Plano', 'Mensalidade', 'Comissão GMV digital', 'Para quem'],
          rows: [
            ['Starter', 'R$ 299', '0,7%', 'Até ~30 mesas · operação enxuta'],
            ['Growth', 'R$ 399', '0,5%', 'Salão médio · fila simples'],
            ['Pro', 'R$ 599', '0,3%', 'Multi-seção · alto volume digital'],
          ],
        },
      ],
    },
    {
      id: 'faq',
      title: 'FAQ — objeções frequentes',
      blocks: [
        {
          type: 'table',
          headers: ['Objeção', 'Resposta sugerida'],
          rows: [
            ['“Já tenho maquininha.”', 'KiComanda não substitui o POS de cartão — complementa. O cliente pede antes de pagar; você paga comissão menor que taxa de maquininha sobre o digital.'],
            ['“Meu cliente é velho, não usa celular.”', 'Quem quiser, o garçom pede pelo app. O QR é opcional por mesa — você escolhe o mix.'],
            ['“NF-e é complicado.”', 'NF-e é opcional. Piloto pode rodar sem nota real (modo simulado) ou manter seu PDV fiscal atual.'],
            ['“Não tenho tempo para implantar.”', 'Salão simples: 3–4 dias nossos + 30 min do dono. Fazemos kickoff, cardápio e treinamento com você.'],
            ['“E se não der certo?”', 'Trial 14 dias ou garantia de 1ª noite real com suporte no WhatsApp.'],
            ['“Quem fica com o dinheiro?”', '100% na conta do restaurante (Asaas/MP/PIX do dono). KiComanda cobra só mensalidade + comissão no dia 5.'],
          ],
        },
      ],
    },
    {
      id: 'proposta',
      title: 'Proposta comercial — template',
      blocks: [
        {
          type: 'text',
          copyable: true,
          body: `PROPOSTA COMERCIAL — KiComanda

Cliente: [Razão social / fantasia]
CNPJ: [·]
Contato: [Nome · WhatsApp · e-mail]

Escopo
• Sistema de pedido na mesa (QR) e/ou balcão
• Painel do dono (dashboard), app garçom e tela cozinha
• Configuração de cardápio, mesas e forma de recebimento (PIX manual + dinheiro no piloto)

Plano contratado: [Starter / Growth / Pro]
Mensalidade: R$ [299 / 399 / 599] — cobrança todo dia 5
Comissão: [%] sobre vendas digitais (PIX/cartão pelo sistema) no mesmo boleto

Implantação
• Kickoff: [data]
• Go-live alvo: [data]
• Responsável KiComanda: [founder]
• Responsável cliente: [dono / gerente]

Trial: 14 dias a partir do go-live (ou conforme combinado)

Validade desta proposta: 7 dias

[Assinatura / aceite por WhatsApp ou e-mail]`,
        },
      ],
    },
    {
      id: 'checklist-vendas',
      title: 'Checklist — pronto para vender',
      blocks: [
        {
          type: 'checklist',
          storageKey: 'kicomanda_materiais_vendas_check_v1',
          items: [
            { id: 'v1', label: 'Pitch deck exportado (PDF + link)' },
            { id: 'v2', label: 'One-pager salvo como PDF e imagem WhatsApp' },
            { id: 'v3', label: 'Vídeo demo gravado e hospedado (Drive/YouTube unlisted)' },
            { id: 'v4', label: '≥2 cases de piloto com foto' },
            { id: 'v5', label: 'Scripts WhatsApp nos atalhos do celular' },
            { id: 'v6', label: 'Template proposta no Google Docs' },
            { id: 'v7', label: 'Agenda de demos compartilhada (Calendly/agenda)' },
          ],
        },
      ],
    },
  ],
}
