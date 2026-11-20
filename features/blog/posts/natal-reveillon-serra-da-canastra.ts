import type { BlogPost } from '../types'
import { commons } from '../photos'
import { PLACES } from '../places'

export const natalReveillonCanastra: BlogPost = {
  slug: 'natal-e-reveillon-na-serra-da-canastra',
  title: 'Natal e Réveillon na Serra da Canastra: como aproveitar o fim de ano',
  description:
    'Cachoeiras cheias, serra verde e virada tranquila: o que fazer na Serra da Canastra no Natal e no Ano-Novo, os cuidados com a chuva e quando reservar.',
  place: 'Serra da Canastra',
  cities: [
    { slug: 'sao-roque-de-minas-mg', name: 'São Roque de Minas' },
    { slug: 'delfinopolis-mg', name: 'Delfinópolis' },
  ],
  publishedAt: '2026-11-20',
  status: 'publicado',
  cover: commons({
    file: 'Serra_da_canastra_casca_d_anta_hdr_by_ssabbath-d8whskv.jpg',
    hash: '3/3f',
    alt: 'Cachoeira Casca d’Anta caindo entre paredões cobertos de mato verde, com céu azul e nuvens',
    credit: 'Walter Ferry Dissmann',
    license: 'CC BY-SA 4.0',
  }),
  blocks: [
    {
      type: 'p',
      text: 'Quem conhece a Serra da Canastra só pelas fotos de inverno, com campo dourado e água cristalina, leva um susto bom no fim do ano. Em dezembro a serra fica **verde de ponta a ponta**, as cachoeiras chegam ao volume máximo e a Casca d’Anta vira um paredão de água. É também a época de chuva, e isso pede um pouco mais de planejamento. Neste guia: o que fazer, os cuidados e como garantir a pousada.',
    },
    {
      type: 'facts',
      items: [
        { label: 'Natal 2026', value: 'Sexta, 25/12: feriadão de 3 dias' },
        { label: 'Ano-Novo 2027', value: 'Sexta, 1º/1: feriadão de 3 dias' },
        { label: 'Clima', value: 'Calor de dia, pancadas de chuva à tarde' },
        { label: 'Bases', value: 'São Roque de Minas, Vargem Bonita e Delfinópolis' },
      ],
    },
    {
      type: 'p',
      text: 'Os dois feriados caem numa sexta-feira, então dá para emendar um fim de semana em cada um, ou tirar a semana entre eles e ficar 10 dias. Veja os próximos feriadões em [nosso calendário](/feriados).',
    },
    { type: 'h2', text: 'Cachoeiras no auge' },
    {
      type: 'p',
      text: 'A **Casca d’Anta**, primeira grande queda do Rio São Francisco, com 186 metros, fica cheia e barulhenta no verão. Pela parte baixa, saindo de Vargem Bonita, a trilha curta até o pé da queda passa por mata fechada. Pela parte alta, dentro do parque, o mirante mostra o rio despencando no vale. No nosso [guia de São Roque de Minas](/blog/serra-da-canastra-o-que-fazer-em-sao-roque-de-minas) tem os dois lados em detalhe.',
    },
    {
      type: 'p',
      text: 'Em Delfinópolis, as dezenas de quedas perto da cidade também ganham força. A água fica menos transparente que na seca, mas o visual de cachoeira cheia no meio do verde compensa. Veja as principais no [guia de Delfinópolis](/blog/delfinopolis-o-que-fazer-cachoeiras-serra-da-canastra).',
    },
    {
      type: 'image',
      photo: commons({
        file: 'PARNA_da_Serra_da_Canastra_-_Rogério_Rodrigues_Nadal(007).jpg',
        hash: '4/42',
        alt: 'Morros cobertos de capim verde e uma árvore retorcida em primeiro plano, na Serra da Canastra',
        credit: 'Rogério Rodrigues Nadal',
        license: 'CC BY-SA 4.0',
      }),
      caption: 'No verão, a serra inteira fica verde.',
    },
    { type: 'h2', text: 'Chuva: os cuidados que fazem diferença' },
    {
      type: 'p',
      text: 'De dezembro a março chove bastante na Canastra, quase sempre em pancadas no meio da tarde. Dá para aproveitar muito, desde que você organize o dia:',
    },
    {
      type: 'list',
      items: [
        '**Cachoeira de manhã.** Saia cedo e deixe a tarde para o queijo, a cidade e a pousada.',
        '**Cuidado com a cabeça d’água.** Chuva forte na cabeceira do rio pode subir o nível da cachoeira em minutos, mesmo com sol onde você está. Água ficando barrenta, galhos descendo ou barulho aumentando: saia do rio na hora.',
        '**Estrada de terra vira barro.** Muitos acessos são de terra e ficam escorregadios. Na dúvida, vá de passeio 4×4 com guia local em vez do carro baixo.',
        '**Horário do parque.** O parque fecha a entrada de carros no meio da tarde. Confirme o horário na portaria antes de sair.',
      ],
    },
    {
      type: 'image',
      photo: commons({
        file: 'Chuva_na_serra_-_Canastra_-_Minas_Gerais.jpg',
        hash: 'a/ac',
        alt: 'Nuvem de chuva cobrindo a serra ao fundo, com vale verde e mata em primeiro plano',
        credit: 'Verospi',
        license: 'CC BY-SA 4.0',
      }),
      caption: 'Pancada de chuva chegando à tarde: hora de voltar para a pousada.',
    },
    {
      type: 'tip',
      text: 'Pergunte à pousada sobre as condições das estradas antes de cada passeio. Quem mora lá sabe qual caminho está bom depois de uma noite de chuva.',
    },
    { type: 'h2', text: 'Ceia mineira e queijo Canastra' },
    {
      type: 'p',
      text: 'Natal na Canastra combina com mesa farta: **queijo Canastra** curado, doce de leite, pão de queijo e comida de fogão a lenha. Visitar uma queijaria e levar queijo para a ceia é um passeio ótimo para as tardes de chuva.',
    },
    {
      type: 'image',
      photo: commons({
        file: 'Queijo_canastra,_Minas_Gerais.jpg',
        hash: '2/29',
        alt: 'Pilhas de queijos Canastra redondos e claros numa prateleira',
        credit: 'Marcelo Costa',
        license: 'CC BY 2.0',
      }),
      caption: 'Queijo Canastra: presente de Natal garantido.',
    },
    {
      type: 'p',
      text: 'As cidades da região são pequenas, e no dia 25 e no dia 1º muito restaurante e comércio fecha ou abre em horário reduzido. Pergunte à pousada se ela vai servir ceia ou almoço de Natal e de Ano-Novo, e faça as compras do mercado antes.',
    },
    { type: 'h2', text: 'Uma virada diferente' },
    {
      type: 'p',
      text: 'Réveillon na Canastra não é festa de multidão. É céu aberto, roda de amigos ou família, comida boa e silêncio de serra. Muita gente passa a virada na própria pousada e acorda no dia 1º para ver a serra verde e uma cachoeira cheia, sem pressa nenhuma.',
    },
    {
      type: 'image',
      photo: commons({
        file: 'PARQUE_NACIONAL_SERRA_DA_CANASTRA_-_ELVIO_GUSMÃO_(1).jpg',
        hash: 'f/f1',
        alt: 'Pôr do sol alaranjado sobre a serra, com uma estrada de terra em primeiro plano',
        credit: 'Elvio Gusmão Santos',
        license: 'CC BY-SA 4.0',
      }),
      caption: 'Último pôr do sol do ano, no alto da serra.',
    },
    { type: 'h2', text: 'Roteiro de 4 dias no fim de ano' },
    {
      type: 'list',
      items: [
        '**Dia 1:** chegada, queijaria à tarde e jantar mineiro.',
        '**Dia 2:** parte alta do parque cedo (nascente e mirante da Casca d’Anta), com os bichos do chapadão no caminho.',
        '**Dia 3:** parte baixa da Casca d’Anta pela manhã, saindo de Vargem Bonita. À tarde, descanso e ceia.',
        '**Dia 4:** cachoeiras perto de Delfinópolis ou de São Roque, e volta para casa depois do almoço.',
      ],
    },
    { type: 'h2', text: 'Reserve cedo' },
    {
      type: 'p',
      text: 'As pousadas da Canastra são pequenas, e o fim de ano é uma das épocas mais disputadas. Muitas pedem estadia mínima nos feriados. Quanto antes você fechar, mais opções tem. Reservando direto pela Rota das Pousadas, você fala com a própria pousada e combina tudo, da ceia ao horário de chegada.',
    },
  ],
  faq: [
    {
      question: 'Vale a pena ir para a Serra da Canastra em dezembro?',
      answer:
        'Sim. É época de chuva, mas a serra fica verde e as cachoeiras chegam ao volume máximo. Planeje as cachoeiras para a manhã, quando chove menos, e deixe as tardes para queijarias e descanso.',
    },
    {
      question: 'É perigoso tomar banho de cachoeira na época de chuva?',
      answer:
        'Exige atenção. Chuva forte na cabeceira pode causar cabeça d’água, uma subida rápida do nível do rio. Se a água ficar barrenta, aparecerem galhos ou o barulho aumentar, saia na hora. Em dia de chuva forte, não entre.',
    },
    {
      question: 'Preciso de carro 4×4 na Canastra no fim de ano?',
      answer:
        'Não para chegar às cidades, mas muitos acessos a cachoeiras e ao parque são de terra e ficam com barro. O mais tranquilo é usar passeios 4×4 com guia local para esses trechos.',
    },
    {
      question: 'Com quanta antecedência reservar pousada para o Réveillon?',
      answer:
        'O quanto antes. As pousadas da região têm poucos quartos e lotam no fim de ano, e muitas pedem estadia mínima nos feriados.',
    },
  ],
  places: [
    PLACES.saoRoque,
    PLACES.nascenteSaoFrancisco,
    PLACES.cascaDAnta,
    PLACES.vargemBonita,
    PLACES.delfinopolis,
  ],
}
