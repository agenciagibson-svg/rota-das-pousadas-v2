import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage, type LegalSection } from '@/components/legal/legal-page'
import { LEGAL, operatorLine } from '@/lib/legal'

export const metadata: Metadata = {
  title: 'Termos de Uso',
  description: 'Regras de uso da Rota das Pousadas para viajantes e pousadas parceiras.',
  alternates: { canonical: '/termos' },
}

const email = <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>

const sections: LegalSection[] = [
  {
    id: 'sobre',
    title: 'O que é a Rota das Pousadas',
    body: (
      <>
        <p>
          A {operatorLine()} é uma plataforma de tecnologia que ajuda viajantes a encontrar e
          reservar pousadas independentes, e oferece às pousadas um sistema de gestão (reservas,
          calendário, hóspedes e pagamentos).
        </p>
        <p>
          <strong>A hospedagem é contratada diretamente com a pousada.</strong> A Rota das Pousadas
          não é a dona nem a administradora das pousadas anunciadas, não presta o serviço de
          hospedagem e não recebe o dinheiro da sua reserva: o pagamento vai direto para a conta da
          pousada.
        </p>
      </>
    ),
  },
  {
    id: 'aceite',
    title: 'Aceite destes termos',
    body: (
      <p>
        Ao criar uma conta, fazer uma reserva ou usar o site, você concorda com estes Termos de Uso
        e com a <Link href="/privacidade">Política de Privacidade</Link>. Se não concordar, não use
        a plataforma.
      </p>
    ),
  },
  {
    id: 'conta',
    title: 'Sua conta',
    body: (
      <ul>
        <li>
          Para reservar, você precisa ter 18 anos ou mais e criar uma conta com e-mail e senha.
        </li>
        <li>
          As informações do seu cadastro precisam ser verdadeiras e suas: nome, data de nascimento,
          documento (CPF ou passaporte), celular e endereço. Cada documento só pode estar em uma
          conta.
        </li>
        <li>
          A senha é pessoal. Você é responsável pelo que for feito com a sua conta. Se perceber uso
          indevido, troque a senha em “Esqueci minha senha” e avise a gente.
        </li>
        <li>Você pode atualizar seus dados a qualquer momento em “Meu perfil”.</li>
      </ul>
    ),
  },
  {
    id: 'reservas',
    title: 'Como funciona a reserva',
    body: (
      <>
        <ul>
          <li>
            Você escolhe as datas e a quantidade de hóspedes. O preço, as regras da casa e a
            política de cancelamento são definidos pela pousada e aparecem antes de você confirmar.
          </li>
          <li>
            Ao confirmar, a reserva fica <strong>aguardando pagamento</strong> e as datas ficam
            guardadas para você por um prazo: <strong>2 horas</strong> quando a pousada recebe
            pagamento on-line, ou <strong>24 horas</strong> quando o pagamento é combinado direto
            com ela. O prazo aparece na tela e no e-mail.
          </li>
          <li>
            Se o pagamento não for identificado dentro do prazo, a reserva pode ser cancelada e as
            datas voltam a ficar disponíveis para outras pessoas.
          </li>
          <li>
            Com o pagamento aprovado, a reserva fica <strong>confirmada</strong> e você recebe o
            comprovante por e-mail. Acompanhe tudo em “Minhas reservas”.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'pagamentos',
    title: 'Pagamentos',
    body: (
      <ul>
        <li>
          O pagamento on-line é processado pelo <strong>Mercado Pago</strong>, diretamente na conta
          da pousada. A Rota das Pousadas não guarda dados do seu cartão.
        </li>
        <li>No pagamento on-line são aceitos Pix e cartão, conforme disponível no Mercado Pago.</li>
        <li>
          Reembolsos, estornos e cobranças extras (como consumo na pousada) são tratados entre você
          e a pousada, de acordo com a política dela e a legislação de defesa do consumidor.
        </li>
      </ul>
    ),
  },
  {
    id: 'cancelamento',
    title: 'Cancelamento e alterações',
    body: (
      <p>
        Cada pousada tem a sua política de cancelamento, informada na página da pousada e no e-mail
        de confirmação. Pedidos de cancelamento ou de mudança de datas podem ser feitos em “Minhas
        reservas” (enquanto a reserva estiver aguardando pagamento) ou direto com a pousada. Os
        valores devolvidos seguem a política da pousada, sempre respeitando a legislação de defesa
        do consumidor.
      </p>
    ),
  },
  {
    id: 'ficha',
    title: 'Ficha de hospedagem (FNRH)',
    body: (
      <p>
        Toda pousada é obrigada por lei a registrar os hóspedes na Ficha Nacional de Registro de
        Hóspedes (Lei nº 11.771/2008 e Decreto nº 7.381/2010). Por isso, quando você reserva, a
        pousada escolhida recebe os dados do seu cadastro necessários para essa ficha. Nenhuma outra
        pousada recebe esses dados. Veja os detalhes na{' '}
        <Link href="/privacidade">Política de Privacidade</Link>.
      </p>
    ),
  },
  {
    id: 'responsabilidades',
    title: 'Responsabilidades',
    body: (
      <>
        <p>
          <strong>A pousada</strong> é responsável pela hospedagem, pelas informações, fotos, preços
          e regras do anúncio, pelo atendimento e pelo cumprimento da política de cancelamento.
        </p>
        <p>
          <strong>A Rota das Pousadas</strong> é responsável pelo funcionamento da plataforma, pela
          segurança das informações que guarda e por mostrar as informações que a pousada cadastrou.
          Trabalhamos para manter o site no ar, mas podem acontecer interrupções para manutenção ou
          por falhas de terceiros.
        </p>
        <p>
          <strong>Você</strong> é responsável pelas informações que fornece, pelo uso da sua conta e
          por respeitar as regras da pousada durante a estadia.
        </p>
      </>
    ),
  },
  {
    id: 'proibido',
    title: 'O que não é permitido',
    body: (
      <ul>
        <li>Usar dados, documento ou cartão de outra pessoa sem autorização.</li>
        <li>Fazer reservas falsas ou para bloquear datas sem intenção de se hospedar.</li>
        <li>Usar robôs, raspagem de dados ou qualquer meio automático para acessar o site.</li>
        <li>Tentar burlar a segurança da plataforma ou acessar contas de outras pessoas.</li>
        <li>Publicar conteúdo ofensivo, discriminatório, falso ou ilegal.</li>
      </ul>
    ),
  },
  {
    id: 'avaliacoes',
    title: 'Avaliações',
    body: (
      <p>
        Só quem se hospedou pela plataforma pode avaliar a pousada. As avaliações precisam refletir
        a sua experiência real e ser respeitosas. Podemos remover avaliações que violem estes
        termos.
      </p>
    ),
  },
  {
    id: 'pousadas',
    title: 'Para pousadas parceiras',
    body: (
      <p>
        O uso do painel de gestão pelas pousadas também segue as condições do plano contratado. A
        pousada é responsável pelo uso que faz dos dados dos seus hóspedes, dentro das finalidades
        da hospedagem e da lei, e deve manter o acesso da sua equipe atualizado.
      </p>
    ),
  },
  {
    id: 'propriedade',
    title: 'Marca e conteúdo',
    body: (
      <p>
        A marca Rota das Pousadas, o site e o sistema pertencem aos seus titulares. Fotos e textos
        das pousadas pertencem às próprias pousadas. Não é permitido copiar ou reutilizar esse
        conteúdo sem autorização.
      </p>
    ),
  },
  {
    id: 'suspensao',
    title: 'Suspensão e encerramento da conta',
    body: (
      <p>
        Podemos suspender ou encerrar contas usadas para fraude ou em desacordo com estes termos.
        Você pode pedir o encerramento da sua conta a qualquer momento pelo e-mail {email}. Alguns
        dados podem ser guardados pelo prazo exigido em lei, como explicado na Política de
        Privacidade.
      </p>
    ),
  },
  {
    id: 'mudancas',
    title: 'Mudanças nestes termos',
    body: (
      <p>
        Podemos atualizar estes termos. A data da última atualização fica no topo da página e, se a
        mudança for importante, avisaremos por e-mail ou no site. Reservas já feitas seguem as
        condições aceitas no momento da reserva.
      </p>
    ),
  },
  {
    id: 'lei',
    title: 'Lei aplicável e foro',
    body: (
      <p>
        Estes termos seguem as leis brasileiras, inclusive o Código de Defesa do Consumidor. Fica
        eleito o foro do domicílio do consumidor para resolver qualquer questão.
      </p>
    ),
  },
  {
    id: 'contato',
    title: 'Contato',
    body: <p>Dúvidas, sugestões ou problemas: {email}.</p>,
  },
]

export default function TermosPage() {
  return (
    <LegalPage
      eyebrow="Documentos"
      title="Termos de Uso"
      intro={
        <p>
          Estes termos explicam, em linguagem simples, como funciona a {LEGAL.brand}, o que você
          pode esperar da plataforma e o que esperamos de quem a usa.
        </p>
      }
      sections={sections}
      related={{ href: '/privacidade', label: 'Política de Privacidade' }}
    />
  )
}
