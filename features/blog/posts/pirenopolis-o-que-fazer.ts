import type { BlogPost } from '../types'
import { commons } from '../photos'

export const pirenopolisOQueFazer: BlogPost = {
  slug: 'pirenopolis-o-que-fazer-cachoeiras-centro-historico',
  title: 'Pirenópolis: o que fazer entre cachoeiras e o centro histórico',
  description:
    'Ruas de pedra do século XVIII, cachoeiras a poucos minutos do centro, pôr do sol nos Pireneus e as Cavalhadas: um roteiro para curtir Piri sem pressa.',
  place: 'Pirenópolis',
  cities: [{ slug: 'pirenopolis-go', name: 'Pirenópolis' }],
  publishedAt: '2026-11-21',
  status: 'rascunho',
  cover: commons({
    file: 'Rua_Nossa_Senhora_do_Rosário,_Pirenópolis,_agosto_de_2023_(7).jpg',
    hash: '2/2e',
    alt: 'Rua de pedra do centro histórico de Pirenópolis, com casarões brancos, buganvília florida e as torres da Matriz ao fundo',
    credit: 'Fronteira',
    license: 'CC BY-SA 4.0',
  }),
  blocks: [
    {
      type: 'p',
      text: '**Pirenópolis**, ou simplesmente **Piri**, nasceu em 1727, quando bandeirantes acharam ouro às margens do Rio das Almas. Do ciclo do ouro ficaram as ruas de pedra, os casarões coloniais e as igrejas. Em volta da cidade, o cerrado esconde dezenas de cachoeiras. Tudo isso a cerca de 2 horas de Brasília e de Goiânia, o que faz de Piri o refúgio de fim de semana preferido das duas capitais.',
    },
    {
      type: 'facts',
      items: [
        { label: 'Onde fica', value: 'Centro de Goiás, entre Brasília e Goiânia' },
        { label: 'Distâncias', value: 'Brasília 150 km · Goiânia 130 km' },
        { label: 'Quanto tempo', value: '2 a 3 dias' },
        { label: 'Precisa de carro?', value: 'Sim, para as cachoeiras' },
      ],
    },
    { type: 'h2', text: 'Centro histórico a pé' },
    {
      type: 'p',
      text: 'O centro é pequeno e feito para caminhar. O conjunto arquitetônico é tombado pelo IPHAN desde 1989. O ponto de partida é a **Igreja Matriz de Nossa Senhora do Rosário**, de 1728, a construção religiosa mais antiga de Goiás. Ela foi restaurada depois de um incêndio e fica linda iluminada à noite.',
    },
    {
      type: 'list',
      items: [
        '**Rua do Rosário (Rua do Lazer):** a rua dos restaurantes, bares e música ao vivo. À noite, as mesas tomam a calçada.',
        '**Rua Direita e Rua Aurora:** casarões coloridos, lojinhas de artesanato e ateliês de prata.',
        '**Igrejas do Carmo e do Bonfim:** também do século XVIII, a poucos quarteirões da Matriz.',
        '**Ponte sobre o Rio das Almas:** a ponte de madeira é um dos cartões-postais da cidade.',
      ],
    },
    {
      type: 'image',
      photo: commons({
        file: 'Vista_do_topo_da_Rua_do_Rosário_com_detalhe_da_Igreja_Matriz_de_Nossa_Senhora_do_Rosário_ao_fundo.jpg',
        hash: '5/5e',
        alt: 'Rua do Rosário à noite, com postes acesos e casarões iluminados descendo em direção à Igreja Matriz',
        credit: 'Rossyni Gomes Pompêo de Pina',
        license: 'CC BY-SA 4.0',
      }),
      caption: 'Rua do Rosário à noite, com a Matriz ao fundo.',
    },
    { type: 'h2', text: 'Cachoeiras perto da cidade' },
    {
      type: 'p',
      text: 'Nenhuma cachoeira fica dentro do centro, mas várias estão a poucos minutos de carro. Quase todas ficam em áreas particulares, com trilha sinalizada, banheiro e lanchonete, e cobram entrada.',
    },
    {
      type: 'list',
      items: [
        '**Cachoeiras Bonsucesso:** as mais perto, a cerca de 5 km do centro. Boas para o primeiro dia.',
        '**Cachoeira do Abade:** queda de cerca de 20 metros com poço para banho, no fim de uma trilha pelo cerrado.',
        '**Santuário Vagafogo:** reserva de cerrado com trilha, poços de água limpa, arvorismo e um brunch famoso.',
        '**Cachoeira do Rosário, Lázaro e Santa Maria:** outras queridinhas, para quem tem mais dias.',
      ],
    },
    {
      type: 'image',
      photo: commons({
        file: 'Cachoeira_do_Abade_AGO_2008.jpg',
        hash: 'c/c5',
        alt: 'Cachoeira do Abade caindo de um paredão coberto de mata num poço verde',
        credit: 'André Luis Rodrigues de Magalhães',
        license: 'Domínio público',
      }),
      caption: 'Cachoeira do Abade.',
    },
    {
      type: 'tip',
      text: 'Piri lota nos fins de semana de sol. Para pegar a cachoeira mais vazia, chegue cedo ou vá durante a semana.',
    },
    { type: 'h2', text: 'Pôr do sol nos Pireneus' },
    {
      type: 'p',
      text: 'O **Parque Estadual dos Pireneus** fica a cerca de 20 km da cidade, subindo a serra por estrada de terra. No alto, uma trilha curta, de uns 15 minutos, leva à **Capela da Santíssima Trindade**, no pico de mais de 1.300 metros, com vista de 360 graus do cerrado. No caminho aparecem formações de pedra como o **Morro do Cabeludo**.',
    },
    {
      type: 'image',
      photo: commons({
        file: 'Morro_cabeludo_-_Parque_dos_Pireneus_-_Pirenópolis_-_Goiás_01.jpg',
        hash: '6/66',
        alt: 'Campo de cerrado dourado com o Morro do Cabeludo ao fundo, sob céu azul com nuvens',
        credit: 'Angeladepaula',
        license: 'CC BY-SA 3.0',
      }),
      caption: 'Morro do Cabeludo, no Parque Estadual dos Pireneus.',
    },
    {
      type: 'tip',
      text: 'O parque abre das 8h às 17h. Para ver o pôr do sol lá de cima, combine com um guia local.',
    },
    { type: 'h2', text: 'Cavalhadas e Festa do Divino' },
    {
      type: 'p',
      text: 'A festa mais famosa de Piri é a **Festa do Divino**, com as **Cavalhadas**: cavaleiros mouros e cristãos encenam uma batalha a cavalo, com roupas bordadas e muito brilho, e os mascarados tomam as ruas. Acontece na época de Pentecostes, entre maio e junho. Fora da festa, o Museu das Cavalhadas mostra máscaras e figurinos.',
    },
    {
      type: 'image',
      photo: commons({
        file: 'Cavalhadas_de_Pirenópolis-GO,_2023_09.jpg',
        hash: '8/88',
        alt: 'Cavaleiros com armaduras e cavalos enfeitados de vermelho e azul durante as Cavalhadas de Pirenópolis',
        credit: 'Michelly Matoss',
        license: 'CC BY-SA 4.0',
      }),
      caption: 'Cavalhadas de Pirenópolis.',
    },
    { type: 'h2', text: 'Roteiro de 3 dias' },
    {
      type: 'list',
      items: [
        '**Dia 1:** chegada, passeio a pé pelo centro histórico e jantar na Rua do Rosário.',
        '**Dia 2:** Santuário Vagafogo de manhã (com o brunch) e Cachoeiras Bonsucesso à tarde.',
        '**Dia 3:** Cachoeira do Abade cedo e, se der, pôr do sol nos Pireneus antes de pegar a estrada.',
      ],
    },
    { type: 'h2', text: 'Quando ir' },
    {
      type: 'p',
      text: 'Piri tem uma estação seca, de maio a setembro, com água mais clara e estradas melhores, e uma chuvosa, de outubro a abril, com cachoeiras cheias e cerrado verde. Feriados e fins de semana enchem rápido, então reserve a pousada com antecedência. Veja os próximos feriadões no [nosso calendário](/feriados).',
    },
  ],
  faq: [
    {
      question: 'Quantos dias ficar em Pirenópolis?',
      answer:
        'Dois a três dias. Dá para conhecer o centro histórico, duas ou três cachoeiras e o Parque dos Pireneus sem correria.',
    },
    {
      question: 'Precisa de carro em Pirenópolis?',
      answer:
        'Para o centro histórico, não: tudo se faz a pé. Para as cachoeiras e o Parque dos Pireneus, sim, ou um passeio com agência local, porque não há transporte público até lá.',
    },
    {
      question: 'Qual a distância de Pirenópolis para Brasília e Goiânia?',
      answer:
        'Cerca de 150 km de Brasília e 130 km de Goiânia, por estrada asfaltada. São umas 2 horas de carro de cada capital.',
    },
    {
      question: 'Quando são as Cavalhadas de Pirenópolis?',
      answer:
        'Na Festa do Divino, que acontece na época de Pentecostes, entre maio e junho. A cidade lota nesse período, então reserve com bastante antecedência.',
    },
  ],
}
