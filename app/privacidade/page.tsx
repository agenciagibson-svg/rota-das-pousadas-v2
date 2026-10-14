import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage, type LegalSection } from '@/components/legal/legal-page'
import { LEGAL, operatorLine } from '@/lib/legal'

export const metadata: Metadata = {
  title: 'Política de Privacidade',
  description:
    'Como a Rota das Pousadas coleta, usa, compartilha e protege seus dados pessoais (LGPD).',
  alternates: { canonical: '/privacidade' },
}

/**
 * Renderização por requisição, como o resto do site: a CSP estrita de
 * `proxy.ts` depende de um nonce por requisição. Pré-renderizada no build, a
 * página saía sem nonce e o navegador bloqueava os scripts do próprio Next
 * (menu e links do cabeçalho paravam de responder). Ver app/not-found.tsx.
 */
export const dynamic = 'force-dynamic'

const email = <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>

const sections: LegalSection[] = [
  {
    id: 'quem-somos',
    title: 'Quem cuida dos seus dados',
    body: (
      <>
        <p>
          A {operatorLine()} é a controladora dos dados da sua conta e do uso do site, nos termos da
          Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD).
        </p>
        <p>
          Quando você reserva, <strong>a pousada escolhida</strong> passa a ser controladora dos
          dados que recebe para a sua hospedagem (por exemplo, a ficha de hospedagem). Nesse caso, a
          Rota das Pousadas guarda e organiza esses dados no sistema da pousada, seguindo as
          instruções dela.
        </p>
        <p>Canal para assuntos de privacidade (encarregado): {email}.</p>
      </>
    ),
  },
  {
    id: 'dados',
    title: 'Quais dados coletamos',
    body: (
      <>
        <p>
          <strong>Conta:</strong> nome, e-mail e senha. A senha fica protegida pelo nosso provedor
          de autenticação e ninguém da equipe consegue vê-la.
        </p>
        <p>
          <strong>Cadastro de viajante:</strong> data de nascimento, nacionalidade, CPF ou
          passaporte, celular, WhatsApp, endereço (CEP, rua, número, complemento, bairro, cidade e
          UF ou país) e, se você quiser informar, contato de emergência, restrições alimentares e
          necessidades de acessibilidade.
        </p>
        <p>
          <strong>Reservas:</strong> pousada, datas, número de hóspedes, valores, status e histórico
          da reserva.
        </p>
        <p>
          <strong>Pagamentos:</strong> status e código do pagamento no Mercado Pago. Não recebemos
          nem guardamos os dados do seu cartão.
        </p>
        <p>
          <strong>Uso do site e segurança:</strong> cookies essenciais de login, registros de acesso
          (como endereço IP e horário) para segurança e prevenção de fraude, e estatísticas de
          visitas agregadas, sem identificar você.
        </p>
      </>
    ),
  },
  {
    id: 'uso',
    title: 'Para que usamos e com que base legal',
    body: (
      <ul>
        <li>
          <strong>Criar e manter sua conta, fazer e acompanhar reservas</strong> e enviar e-mails
          sobre elas (pedido recebido, confirmação, lembrete de check-in, nova senha) — execução de
          contrato (art. 7º, V, da LGPD).
        </li>
        <li>
          <strong>Enviar à pousada os dados da ficha de hospedagem</strong> — cumprimento de
          obrigação legal da pousada (Lei nº 11.771/2008 e Decreto nº 7.381/2010; art. 7º, II, da
          LGPD) e execução do contrato de hospedagem.
        </li>
        <li>
          <strong>Segurança:</strong> limitar tentativas de login e de troca de senha, evitar contas
          duplicadas e prevenir fraudes — legítimo interesse (art. 7º, IX) e proteção do crédito e
          de fraudes.
        </li>
        <li>
          <strong>Necessidades de acessibilidade e restrições alimentares</strong> (opcionais): só
          são usadas para a pousada preparar a sua estadia, com base no seu consentimento (art. 11,
          I). Você pode apagar esses campos quando quiser em “Meu perfil”.
        </li>
        <li>
          <strong>Estatísticas de visitas</strong> agregadas, para melhorar o site — legítimo
          interesse.
        </li>
      </ul>
    ),
  },
  {
    id: 'compartilhamento',
    title: 'Com quem compartilhamos',
    body: (
      <>
        <p>Não vendemos seus dados. Eles são compartilhados só quando necessário:</p>
        <ul>
          <li>
            <strong>A pousada em que você reserva</strong> — seus dados de cadastro e da reserva,
            para a hospedagem e a ficha obrigatória. Pousadas em que você não reservou não veem seus
            dados.
          </li>
          <li>
            <strong>Mercado Pago</strong> — para processar o pagamento (nome, e-mail e valor).
          </li>
          <li>
            <strong>Provedores de tecnologia</strong> que mantêm a plataforma funcionando, sob
            contrato e só para esse fim: Supabase (banco de dados e login), Vercel (hospedagem do
            site e estatísticas de visitas) e Google (envio dos e-mails).
          </li>
          <li>
            <strong>Serviços de CEP</strong> (ViaCEP e BrasilAPI) — recebem apenas o número do CEP
            digitado, para preencher o endereço.
          </li>
          <li>
            <strong>Autoridades</strong>, quando houver obrigação legal ou ordem judicial.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'internacional',
    title: 'Transferência para outros países',
    body: (
      <p>
        Alguns provedores de tecnologia podem armazenar ou processar dados fora do Brasil (por
        exemplo, nos Estados Unidos). Nesses casos, usamos empresas que oferecem garantias de
        proteção compatíveis com a LGPD (art. 33).
      </p>
    ),
  },
  {
    id: 'seguranca',
    title: 'Como protegemos seus dados',
    body: (
      <ul>
        <li>Conexão sempre criptografada (HTTPS).</li>
        <li>
          CPF e passaporte são guardados criptografados; nas telas aparecem só os últimos dígitos.
        </li>
        <li>
          Cada pessoa só acessa os próprios dados, e cada pousada só acessa os hóspedes que
          reservaram com ela, com controle de acesso direto no banco de dados.
        </li>
        <li>
          Limite de tentativas de login e de pedidos de nova senha, e registro de ações sensíveis.
        </li>
      </ul>
    ),
  },
  {
    id: 'retencao',
    title: 'Por quanto tempo guardamos',
    body: (
      <p>
        Guardamos seus dados enquanto sua conta estiver ativa. Se você pedir o encerramento da
        conta, apagamos ou anonimizamos os dados, exceto os que precisamos manter por obrigação
        legal ou regulatória (como registros de reservas, pagamentos e da ficha de hospedagem), pelo
        prazo que a lei exigir.
      </p>
    ),
  },
  {
    id: 'direitos',
    title: 'Seus direitos',
    body: (
      <>
        <p>Pela LGPD (art. 18), você pode pedir, a qualquer momento:</p>
        <ul>
          <li>confirmação de que tratamos seus dados e acesso a eles;</li>
          <li>correção de dados incompletos, errados ou desatualizados;</li>
          <li>anonimização, bloqueio ou eliminação de dados desnecessários ou excessivos;</li>
          <li>portabilidade dos dados;</li>
          <li>eliminação dos dados tratados com o seu consentimento;</li>
          <li>informação sobre com quem compartilhamos seus dados;</li>
          <li>revogação do consentimento.</li>
        </ul>
        <p>
          Muitos dados você mesmo corrige em <Link href="/conta">Meu perfil</Link>. Para os demais
          pedidos, escreva para {email}. Respondemos em até 15 dias. Se não ficar satisfeito, você
          também pode procurar a Autoridade Nacional de Proteção de Dados (ANPD).
        </p>
      </>
    ),
  },
  {
    id: 'cookies',
    title: 'Cookies',
    body: (
      <>
        <p>
          Usamos apenas <strong>cookies essenciais</strong>: os que mantêm você logado e protegem a
          sua sessão. Sem eles, o login e as reservas não funcionam.
        </p>
        <p>
          As estatísticas de visitas são coletadas de forma agregada e sem cookies de rastreamento.
          Não usamos cookies de publicidade nem compartilhamos sua navegação com anunciantes.
        </p>
      </>
    ),
  },
  {
    id: 'menores',
    title: 'Crianças e adolescentes',
    body: (
      <p>
        A conta e a reserva são feitas por maiores de 18 anos. Dados de crianças e adolescentes que
        viajam junto só são informados pelo responsável, quando exigidos para a ficha de hospedagem,
        e usados apenas para essa finalidade.
      </p>
    ),
  },
  {
    id: 'mudancas',
    title: 'Mudanças nesta política',
    body: (
      <p>
        Podemos atualizar esta política. A data da última atualização fica no topo da página e, se a
        mudança for importante, avisaremos por e-mail ou no site.
      </p>
    ),
  },
  {
    id: 'contato',
    title: 'Fale com a gente',
    body: <p>Dúvidas ou pedidos sobre seus dados: {email}.</p>,
  },
]

export default function PrivacidadePage() {
  return (
    <LegalPage
      eyebrow="Documentos"
      title="Política de Privacidade"
      intro={
        <p>
          Esta política explica quais dados pessoais a {LEGAL.brand} coleta, para que usa, com quem
          compartilha e como você pode exercer seus direitos.
        </p>
      }
      sections={sections}
      related={{ href: '/termos', label: 'Termos de Uso' }}
    />
  )
}
