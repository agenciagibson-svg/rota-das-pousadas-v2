import {
  BriefcaseBusiness,
  CalendarCheck,
  Gauge,
  Hotel,
  Leaf,
  LifeBuoy,
  Mail,
  Map,
  Megaphone,
  Newspaper,
  Plus,
  Route,
  ScrollText,
  Sparkles,
  Tags,
} from 'lucide-react'

/**
 * Links do rodapé, com os textos dos cartões interativos do desktop. Ficam
 * num módulo comum (não 'use client') para o rodapé do celular, que é
 * renderizado no servidor, poder lê-los.
 */
export const routes = [
  {
    label: 'Destinos',
    href: '/#destinos',
    image: '/images/canastra.png',
    icon: Map,
    kicker: 'Comece pelo mapa',
    title: 'Serra, praia ou cerrado?',
    detail:
      'Passe pelas paisagens e deixe a rota apontar para o tipo de viagem que combina com o seu momento.',
    tone: 'text-liquen',
  },
  {
    label: 'Experiências',
    href: '/#experiencias',
    image: '/images/experience.png',
    icon: Sparkles,
    kicker: 'Escolha pelo clima',
    title: 'Natureza, luxo, romance ou aventura.',
    detail: 'A navegação sai do comum: primeiro a sensação da viagem, depois a pousada ideal.',
    tone: 'text-liquen',
  },
  {
    label: 'Pousadas',
    href: '/pousadas',
    image: '/images/pousada-1.png',
    icon: Hotel,
    kicker: 'Veja a sequência completa',
    title: 'Todas as pousadas em uma trilha visual.',
    detail: 'Abra qualquer pousada para ver o slide de fotos e reservar logo abaixo.',
    tone: 'text-liquen',
  },
  {
    label: 'Ofertas',
    href: '/pousadas',
    image: '/images/capitolio.png',
    icon: Tags,
    kicker: 'Próxima camada',
    title: 'Datas boas merecem ofertas vivas.',
    detail: 'A base já leva para as pousadas; depois encaixamos preços dinâmicos por temporada.',
    tone: 'text-liquen',
  },
  {
    label: 'Roteiros',
    href: '/#editorial',
    image: '/images/jalapao.png',
    icon: Route,
    kicker: 'Monte uma jornada',
    title: 'Uma rota, várias pousadas, zero planilha.',
    detail:
      'A ideia é evoluir para roteiros combinados, com pernoites sugeridos e distâncias inteligentes.',
    tone: 'text-liquen',
  },
]

export const ownerActions = [
  {
    label: 'Anunciar',
    href: '/anunciar',
    icon: Plus,
    title: 'Coloque sua pousada na rota',
    detail: 'Cadastro rápido, análise de curadoria e publicação para receber reservas diretas.',
    metric: '0% comissão',
  },
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: Gauge,
    title: 'Controle a operação em um painel',
    detail: 'Reservas, acomodações, financeiro e configurações no mesmo lugar.',
    metric: '24h online',
  },
  {
    label: 'Reservas',
    href: '/dashboard/reservas',
    icon: CalendarCheck,
    title: 'Acompanhe cada reserva',
    detail: 'Veja hóspede, período, prazo de pagamento, status e ações do proprietário.',
    metric: 'tempo real',
  },
  {
    label: 'Marketing',
    href: '/dashboard/marketing',
    icon: Megaphone,
    title: 'Transforme baixa ocupação em campanha',
    detail: 'Sugestões por temporada, feriados e oportunidades comerciais.',
    metric: 'IA aplicada',
  },
  {
    label: 'Suporte',
    href: '/dashboard/mensagens',
    icon: LifeBuoy,
    title: 'Converse com hóspedes e parceiros',
    detail: 'Central para dúvidas, histórico por reserva e respostas rápidas.',
    metric: 'humano + IA',
  },
]

export const companyLinks = [
  {
    label: 'História',
    href: '#',
    icon: ScrollText,
    title: 'A rota nasce das pousadas com alma',
    detail:
      'Uma marca feita para valorizar hospedagens independentes, destinos brasileiros e viagens com mais significado.',
    step: 'origem',
  },
  {
    label: 'Sustentabilidade',
    href: '#',
    icon: Leaf,
    title: 'Turismo que respeita o lugar',
    detail:
      'Curadoria para destacar pousadas conectadas com natureza, comunidade local e operação responsável.',
    step: 'impacto',
  },
  {
    label: 'Imprensa',
    href: '#',
    icon: Newspaper,
    title: 'Uma nova vitrine para o turismo nacional',
    detail:
      'Materiais, releases e dados da plataforma para contar a expansão da Rota das Pousadas.',
    step: 'voz',
  },
  {
    label: 'Carreiras',
    href: '#',
    icon: BriefcaseBusiness,
    title: 'Gente construindo tecnologia com hospitalidade',
    detail: 'Produto, operação, marketing e IA trabalhando para aproximar pousadas e viajantes.',
    step: 'time',
  },
  {
    label: 'Contato',
    href: 'mailto:agenciagibson@gmail.com',
    icon: Mail,
    title: 'Fale com a Rota das Pousadas',
    detail: 'Parcerias, suporte, imprensa e oportunidades podem começar por uma mensagem simples.',
    step: 'conversa',
  },
]
