import type { Metadata } from 'next'
import { LegalPageShell, LegalSection } from '@/components/legal-page-shell'

export const metadata: Metadata = {
  title: 'Política de Privacidade — KiComanda',
  description: 'Como a KiComanda trata dados pessoais de restaurantes e clientes, em conformidade com a LGPD.',
}

export default function PrivacidadePage() {
  return (
    <LegalPageShell
      title="Política de Privacidade"
      subtitle="Esta política descreve como coletamos, usamos, armazenamos e protegemos dados pessoais na plataforma KiComanda, em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018)."
      updatedAt="31 de maio de 2026"
    >
      <LegalSection title="1. Controlador e contato">
        <p>
          A KiComanda atua como <strong>operadora de plataforma</strong> na prestação do serviço tecnológico.
          Restaurantes parceiros podem atuar como <strong>controladores</strong> em relação aos dados de
          seus clientes finais (pedidos, visitas, fidelidade).
        </p>
        <p>
          Canal para exercer direitos ou esclarecer dúvidas sobre privacidade:{' '}
          <a href="mailto:contato@kicomanda.com.br" className="underline underline-offset-2" style={{ color: '#00E676' }}>
            contato@kicomanda.com.br
          </a>
        </p>
      </LegalSection>

      <LegalSection title="2. Dados que coletamos">
        <p><strong>Restaurantes e administradores</strong></p>
        <ul className="list-disc pl-5 space-y-2">
          <li>Dados de cadastro e autenticação (e-mail, credenciais de acesso);</li>
          <li>Dados do estabelecimento (nome, slug, logo, configurações operacionais);</li>
          <li>Credenciais de integração de pagamento, quando configuradas;</li>
          <li>Registros de uso do painel e logs técnicos.</li>
        </ul>
        <p><strong>Clientes finais (comensais)</strong></p>
        <ul className="list-disc pl-5 space-y-2">
          <li>Nome, sobrenome e WhatsApp (identificador principal);</li>
          <li>Documento (CPF ou passaporte), quando informado no check-in;</li>
          <li>PIN de acesso e, quando aplicável, senha para operações com cartão salvo;</li>
          <li>Pedidos, preferências, histórico de visitas, recibos e pagamentos;</li>
          <li>Dados de cartão tokenizados pelo processador de pagamento (não armazenamos número completo);</li>
          <li>Identificadores de sessão na mesa e dados técnicos (navegador, IP, timestamps).</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Finalidades e bases legais">
        <ul className="list-disc pl-5 space-y-2">
          <li><strong>Prestação do serviço</strong> — check-in, pedidos, pagamentos, recibos e fidelidade (execução de contrato);</li>
          <li><strong>Segurança</strong> — autenticação, prevenção a fraudes e proteção de contas (legítimo interesse e obrigação legal);</li>
          <li><strong>Comunicações operacionais</strong> — confirmações, avisos de pagamento ou status de pedido (execução de contrato);</li>
          <li><strong>Melhoria do produto</strong> — métricas agregadas e diagnóstico técnico (legítimo interesse, com minimização);</li>
          <li><strong>Marketing</strong> — promoções e novidades, quando houver consentimento ou opt-in do usuário.</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Compartilhamento com terceiros">
        <p>Podemos compartilhar dados estritamente necessários com:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li><strong>Supabase</strong> — hospedagem de banco de dados, autenticação e armazenamento de arquivos;</li>
          <li><strong>Processadores de pagamento</strong> — PIX, cartão e repasses ao restaurante, quando o KiComanda Pay está ativo;</li>
          <li><strong>Vercel</strong> — hospedagem da aplicação web;</li>
          <li><strong>Restaurante parceiro</strong> — dados de pedidos e visitas vinculados à operação do estabelecimento;</li>
          <li><strong>Autoridades</strong> — quando exigido por lei ou ordem judicial.</li>
        </ul>
        <p>Não vendemos dados pessoais a terceiros.</p>
      </LegalSection>

      <LegalSection title="5. Armazenamento e retenção">
        <p>
          Dados são armazenados em servidores cloud, preferencialmente com medidas de criptografia em
          trânsito (HTTPS) e controles de acesso. Documentos sensíveis como CPF podem ser armazenados
          de forma criptografada ou com hash irreversível, conforme a finalidade.
        </p>
        <p>
          Mantemos os dados pelo tempo necessário à operação do serviço, cumprimento de obrigações legais
          (fiscais, consumeristas) e resolução de disputas. Após esse período, dados podem ser
          anonimizados ou eliminados de forma segura.
        </p>
      </LegalSection>

      <LegalSection title="6. Cookies e armazenamento local">
        <p>
          Utilizamos cookies essenciais e armazenamento local do navegador (<code className="text-xs px-1 py-0.5 rounded" style={{ background: '#21262D' }}>localStorage</code>,{' '}
          <code className="text-xs px-1 py-0.5 rounded" style={{ background: '#21262D' }}>sessionStorage</code>) para manter sessão de mesa,
          identificação do cliente e preferências no dispositivo. Tokens de autenticação para áreas
          sensíveis (ex.: cartões salvos) possuem expiração por tempo e inatividade.
        </p>
        <p>
          Você pode limpar dados locais pelo navegador; isso pode exigir novo login ou check-in na mesa.
        </p>
      </LegalSection>

      <LegalSection title="7. Segurança">
        <p>
          Adotamos medidas técnicas e organizacionais proporcionais ao risco, incluindo controle de
          acesso, segregação de ambientes, hash de PIN/senhas, tokens assinados para desafios de login
          e políticas de expiração de sessão. Nenhum sistema é 100% seguro; recomendamos que usuários
          protejam dispositivos e não compartilhem PINs.
        </p>
      </LegalSection>

      <LegalSection title="8. Seus direitos (LGPD)">
        <p>Você pode solicitar, nos termos da LGPD:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>Confirmação da existência de tratamento e acesso aos dados;</li>
          <li>Correção de dados incompletos ou desatualizados;</li>
          <li>Anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade;</li>
          <li>Portabilidade, quando aplicável;</li>
          <li>Revogação de consentimento e informação sobre compartilhamentos.</li>
        </ul>
        <p>
          Envie pedidos para{' '}
          <a href="mailto:contato@kicomanda.com.br" className="underline underline-offset-2" style={{ color: '#00E676' }}>
            contato@kicomanda.com.br
          </a>
          . Responderemos em prazo razoável, conforme a legislação.
        </p>
      </LegalSection>

      <LegalSection title="9. Crianças e adolescentes">
        <p>
          A KiComanda não se destina a menores de 18 anos sem supervisão. Dados de menores só devem ser
          informados com responsabilidade de adulto acompanhante ou conforme permitido pela lei aplicável.
        </p>
      </LegalSection>

      <LegalSection title="10. Transferência internacional">
        <p>
          Provedores de infraestrutura (como Supabase e Vercel) podem processar dados em servidores fora
          do Brasil. Nesses casos, buscamos garantias contratuais e medidas de proteção compatíveis com a LGPD.
        </p>
      </LegalSection>

      <LegalSection title="11. Alterações desta política">
        <p>
          Podemos atualizar esta Política de Privacidade periodicamente. A data da última revisão será
          indicada no topo da página. Alterações relevantes podem ser comunicadas por e-mail ou aviso
          na plataforma.
        </p>
      </LegalSection>

      <LegalSection title="12. Contato">
        <p>
          Privacidade e proteção de dados:{' '}
          <a href="mailto:contato@kicomanda.com.br" className="underline underline-offset-2" style={{ color: '#00E676' }}>
            contato@kicomanda.com.br
          </a>
        </p>
      </LegalSection>
    </LegalPageShell>
  )
}
