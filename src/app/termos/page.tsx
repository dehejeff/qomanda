import type { Metadata } from 'next'
import { LegalPageShell, LegalSection } from '@/components/legal-page-shell'

export const metadata: Metadata = {
  title: 'Termos de Uso — KiComanda',
  description: 'Termos de uso da plataforma KiComanda para restaurantes e clientes.',
}

export default function TermosPage() {
  return (
    <LegalPageShell
      title="Termos de Uso"
      subtitle="Estes termos regem o acesso e a utilização da plataforma KiComanda por restaurantes parceiros, colaboradores e clientes finais."
      updatedAt="31 de maio de 2026"
    >
      <LegalSection title="1. Quem somos">
        <p>
          A <strong>KiComanda</strong> é uma plataforma digital que permite a restaurantes oferecerem cardápio,
          pedidos na mesa, pagamentos e programas de fidelidade aos seus clientes, por meio de aplicativo web
          (PWA) e painel administrativo.
        </p>
        <p>
          Dúvidas sobre estes termos podem ser enviadas para{' '}
          <a href="mailto:contato@kicomanda.com.br" className="underline underline-offset-2" style={{ color: '#00E676' }}>
            contato@kicomanda.com.br
          </a>.
        </p>
      </LegalSection>

      <LegalSection title="2. Aceitação">
        <p>
          Ao acessar ou utilizar a KiComanda — seja como restaurante, colaborador autorizado ou cliente — você
          declara ter lido, compreendido e concordado com estes Termos de Uso e com a nossa{' '}
          <a href="/privacidade" className="underline underline-offset-2" style={{ color: '#00E676' }}>
            Política de Privacidade
          </a>.
        </p>
        <p>
          Se você não concordar com qualquer disposição, não utilize a plataforma.
        </p>
      </LegalSection>

      <LegalSection title="3. Contas e perfis">
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong>Restaurantes</strong> criam conta administrativa para configurar cardápio, mesas, pedidos
            e pagamentos. O titular da conta é responsável por manter credenciais seguras e por autorizar
            colaboradores.
          </li>
          <li>
            <strong>Clientes</strong> são identificados principalmente pelo número de WhatsApp informado no
            check-in ou cadastro. Podem definir PIN de acesso para retomar visitas e acessar a área Hub.
          </li>
          <li>
            Você é responsável pela veracidade dos dados informados e por atividades realizadas com sua conta
            ou dispositivo.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Uso permitido">
        <p>Você concorda em utilizar a KiComanda apenas para fins lícitos, relacionados à operação ou consumo
          em restaurantes parceiros. É proibido:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>Tentar acessar áreas, dados ou contas de terceiros sem autorização;</li>
          <li>Interferir no funcionamento da plataforma, realizar engenharia reversa ou uso abusivo de APIs;</li>
          <li>Inserir conteúdo falso, ofensivo ou que viole direitos de terceiros;</li>
          <li>Utilizar a plataforma para fraudes, pagamentos não autorizados ou lavagem de dados.</li>
        </ul>
      </LegalSection>

      <LegalSection title="5. Pedidos, mesas e pagamentos">
        <p>
          Pedidos feitos pelo cliente são encaminhados ao restaurante responsável pela preparação e entrega
          na mesa. Preços, disponibilidade, impostos e taxas de serviço são definidos pelo estabelecimento,
          salvo quando indicado de outra forma na interface.
        </p>
        <p>
          Pagamentos podem ser processados por provedores terceiros parceiros. Ao pagar, você também
          concorda com os termos aplicáveis do processador de pagamento. A KiComanda não é instituição
          financeira e atua como intermediadora tecnológica.
        </p>
        <p>
          Comprovantes, recibos e códigos de confirmação exibidos na plataforma servem como registro da
          transação entre cliente e restaurante, conforme regras do estabelecimento.
        </p>
      </LegalSection>

      <LegalSection title="6. Responsabilidades do restaurante">
        <p>O restaurante parceiro é responsável por:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>Conteúdo do cardápio, preços, alergênicos e informações exibidas aos clientes;</li>
          <li>Cumprimento de normas sanitárias, fiscais e consumeristas aplicáveis ao seu negócio;</li>
          <li>Emissão de documentos fiscais quando exigido por lei;</li>
          <li>Tratamento adequado dos dados pessoais de clientes na medida em que atua como controlador
            perante a LGPD.</li>
        </ul>
      </LegalSection>

      <LegalSection title="7. Propriedade intelectual">
        <p>
          A marca KiComanda, software, layout, textos institucionais e demais elementos da plataforma são
          protegidos por direitos de propriedade intelectual. Não é permitida cópia, modificação ou
          distribuição sem autorização prévia por escrito.
        </p>
        <p>
          Conteúdos enviados pelo restaurante (logos, fotos de pratos, descrições) permanecem de sua
          titularidade, concedendo à KiComanda licença limitada para exibição e operação do serviço.
        </p>
      </LegalSection>

      <LegalSection title="8. Disponibilidade e alterações">
        <p>
          Buscamos alta disponibilidade, mas a plataforma pode passar por manutenções, atualizações ou
          indisponibilidades temporárias. Funcionalidades podem ser alteradas, ampliadas ou descontinuadas
          conforme evolução do produto, com comunicação razoável quando aplicável.
        </p>
        <p>
          O roadmap público em{' '}
          <a href="/roadmap" className="underline underline-offset-2" style={{ color: '#00E676' }}>/roadmap</a>{' '}
          descreve direções do produto, sem garantia de prazos ou escopo definitivo.
        </p>
      </LegalSection>

      <LegalSection title="9. Limitação de responsabilidade">
        <p>
          Na extensão permitida pela lei, a KiComanda não se responsabiliza por danos indiretos, lucros
          cessantes ou prejuízos decorrentes de: (i) conteúdo ou conduta de restaurantes ou clientes;
          (ii) falhas de internet ou dispositivos do usuário; (iii) serviços de terceiros integrados;
          (iv) caso fortuito ou força maior.
        </p>
        <p>
          Nada nestes termos exclui direitos irrenunciáveis previstos no Código de Defesa do Consumidor
          quando aplicável.
        </p>
      </LegalSection>

      <LegalSection title="10. Suspensão e encerramento">
        <p>
          Podemos suspender ou encerrar contas que violem estes termos, representem risco à segurança ou
          à operação da plataforma, ou mediante solicitação do titular, observadas obrigações legais de
          retenção de dados.
        </p>
        <p>
          Clientes podem encerrar participação em uma mesa pela interface do perfil, quando não houver
          valores em aberto, ou deixar de utilizar o serviço a qualquer momento.
        </p>
      </LegalSection>

      <LegalSection title="11. Lei aplicável e foro">
        <p>
          Estes termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro da
          comarca do domicílio do consumidor, quando aplicável o CDC, ou, no caso de relação B2B entre
          KiComanda e restaurante, o foro da comarca de São Paulo/SP, salvo disposição legal em contrário.
        </p>
      </LegalSection>

      <LegalSection title="12. Contato">
        <p>
          Para questões sobre estes Termos de Uso:{' '}
          <a href="mailto:contato@kicomanda.com.br" className="underline underline-offset-2" style={{ color: '#00E676' }}>
            contato@kicomanda.com.br
          </a>
        </p>
      </LegalSection>
    </LegalPageShell>
  )
}
