import type { BlogPost } from '../types'
import { commons } from '../photos'
import { PLACES } from '../places'

export const delfinopolisCachoeiras: BlogPost = {
  slug: 'delfinopolis-o-que-fazer-cachoeiras-serra-da-canastra',
  title: 'Delfinópolis: o que fazer na terra das cachoeiras da Canastra',
  description:
    'Mais de 150 cachoeiras, o Caminho do Céu, o Vale do Gurita e fim de tarde na represa: como aproveitar Delfinópolis, o lado selvagem da Serra da Canastra.',
  place: 'Serra da Canastra',
  cities: [{ slug: 'delfinopolis-mg', name: 'Delfinópolis' }],
  publishedAt: '2026-11-20',
  status: 'publicado',
  cover: commons({
    file: 'Delfinópolis-14_(54065731441).jpg',
    hash: '5/56',
    alt: 'Cachoeira caindo num poço largo entre dois morros cobertos de mata, em Delfinópolis',
    credit: 'Otávio Nogueira',
    license: 'CC BY 2.0',
  }),
  blocks: [
    {
      type: 'p',
      text: 'Se São Roque de Minas é a porta da nascente do São Francisco, **Delfinópolis** é o lado das cachoeiras da Serra da Canastra. A cidade pequena, no sudoeste de Minas, tem **mais de 150 quedas d’água catalogadas**, entre paredões de quartzito, cânions e vales de cerrado. Dá para passar dias pulando de poço em poço sem repetir.',
    },
    {
      type: 'facts',
      items: [
        { label: 'Onde fica', value: 'Sudoeste de Minas, na Serra da Canastra' },
        { label: 'Distâncias', value: 'Uberlândia 305 km · BH 400 km · SP 420 km' },
        { label: 'Melhor época', value: 'Seca, de maio a setembro' },
        { label: 'Quanto tempo', value: '3 a 5 dias para ver com calma' },
      ],
    },
    { type: 'h2', text: 'Cachoeiras perto da cidade' },
    {
      type: 'p',
      text: 'Muitas cachoeiras ficam a poucos quilômetros do centro e têm acesso por carro comum na seca. A maioria está em propriedades particulares, que cobram uma taxa de visitação e cuidam das trilhas.',
    },
    {
      type: 'list',
      items: [
        '**Complexo do Claro:** cinco quedas numa trilha de cerca de 2,5 km ida e volta, a uns 7 km da cidade.',
        '**Complexo do Paraíso:** oito quedas e uma gruta, com trilha autoguiada, a uns 10 km.',
        '**Ézio e Acqualume:** pertinho da cidade (cerca de 5 km), com várias quedas pequenas e trilhas fáceis — bom para o primeiro dia.',
        '**Complexo do Baú:** a Cachoeira Esmeralda fica junto da recepção, sem trilha. As outras quedas pedem uma caminhada de cerca de 2 km.',
      ],
    },
    {
      type: 'image',
      photo: commons({
        file: 'Cachoeira_da_Paz.JPG',
        hash: 'b/bb',
        alt: 'Cachoeira da Paz caindo em degraus de pedra num poço escuro cercado de mata',
        credit: 'Gustavo Asciutti',
        license: 'CC BY-SA 4.0',
      }),
      caption: 'Cachoeira da Paz, no Complexo do Claro.',
    },
    { type: 'h2', text: 'Cânions e quedas grandes' },
    {
      type: 'p',
      text: 'Para quem gosta de trilha mais puxada, o **Paraíso Selvagem** reúne dois cânions e um circuito de 12 quedas. A estrela é a **Cachoeira do Alpinista**, com cerca de 40 metros, numa trilha de 2 km ida e volta com travessias de rio. O circuito completo passa de 10 km, de dificuldade média a difícil.',
    },
    {
      type: 'image',
      photo: commons({
        file: 'Delfinópolis-19_(54065731931).jpg',
        hash: '1/16',
        alt: 'Cachoeira alta descendo um paredão de pedra no meio da mata, em Delfinópolis',
        credit: 'Otávio Nogueira',
        license: 'CC BY 2.0',
      }),
      caption: 'Queda alta entre paredões: a cara de Delfinópolis.',
    },
    { type: 'h2', text: 'Caminho do Céu e Vale do Gurita' },
    {
      type: 'p',
      text: 'O **Caminho do Céu** é um trajeto off-road pela serra, que sobe de cerca de 670 para mais de 1.400 metros de altitude, com mirantes e formações de pedra pelo caminho. Do outro lado fica o **Vale do Gurita**, uma planície estreita de uns 60 km entre duas montanhas, com cachoeiras como a Zé Carlinhos, a do Ouro e a Encantada.',
    },
    {
      type: 'tip',
      text: 'O Caminho do Céu geralmente só é feito de 4×4, principalmente com chuva. O mais tranquilo é ir com guia local, num passeio de um dia que já inclui cachoeiras do Vale do Gurita.',
    },
    {
      type: 'image',
      photo: commons({
        file: 'Delfinópolis-23_(54065733276).jpg',
        hash: '4/47',
        alt: 'Campo seco com a serra ao fundo, em Delfinópolis',
        credit: 'Otávio Nogueira',
        license: 'CC BY 2.0',
      }),
      caption: 'Campo e serra no caminho entre as cachoeiras.',
    },
    { type: 'h2', text: 'Fim de tarde na represa' },
    {
      type: 'p',
      text: 'A cidade fica na beira da represa, e a travessia de balsa é um dos caminhos para chegar. No fim do dia, vale parar na margem para ver o sol baixar sobre a água. Na região também dá para fazer passeio de barco.',
    },
    {
      type: 'image',
      photo: commons({
        file: 'Represa_Delfinópolis_fim_de_tarde.jpg',
        hash: '9/9f',
        alt: 'Pôr do sol alaranjado sobre a represa de Delfinópolis, com um barco pequeno na água',
        credit: 'Marcell Rafael',
        license: 'CC BY-SA 4.0',
      }),
      caption: 'Fim de tarde na represa, esperando a balsa.',
    },
    { type: 'h2', text: 'Queijo e comida mineira' },
    {
      type: 'p',
      text: 'Delfinópolis faz parte da região do **queijo Canastra**, e a comida de fogão a lenha está em restaurantes e pousadas. Depois de um dia de trilha, não tem nada melhor.',
    },
    { type: 'h2', text: 'Roteiro de 3 dias' },
    {
      type: 'list',
      items: [
        '**Dia 1:** cachoeiras perto da cidade (Claro ou Paraíso) e fim de tarde na represa.',
        '**Dia 2:** Caminho do Céu e Vale do Gurita, de 4×4 com guia.',
        '**Dia 3:** Paraíso Selvagem e a Cachoeira do Alpinista, para quem quer trilha mais longa — ou Baú e Esmeralda, para um dia tranquilo.',
      ],
    },
    {
      type: 'p',
      text: 'Quer juntar com a parte alta do parque e a Casca d’Anta? Veja o guia de [São Roque de Minas](/blog/serra-da-canastra-o-que-fazer-em-sao-roque-de-minas).',
    },
  ],
  faq: [
    {
      question: 'Qual a melhor época para ir a Delfinópolis?',
      answer:
        'A seca, de maio a setembro: estradas mais seguras e água mais cristalina. De outubro a abril chove mais, as quedas ficam mais cheias e as trilhas podem ficar escorregadias.',
    },
    {
      question: 'Precisa de 4×4 em Delfinópolis?',
      answer:
        'Para a maioria das cachoeiras, não: na seca dá para ir de carro comum (só a cidade tem asfalto, o resto é terra). O Caminho do Céu e algumas quedas mais distantes pedem 4×4.',
    },
    {
      question: 'As cachoeiras de Delfinópolis são pagas?',
      answer:
        'A maioria fica em propriedades particulares e cobra uma taxa de visitação. Leve dinheiro ou confirme se aceitam Pix.',
    },
  ],
  places: [PLACES.delfinopolis, PLACES.cachoeiraDaPaz],
}
