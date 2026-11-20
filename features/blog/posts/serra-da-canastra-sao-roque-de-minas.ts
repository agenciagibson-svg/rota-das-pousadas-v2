import type { BlogPost } from '../types'
import { commons } from '../photos'

export const serraDaCanastraSaoRoque: BlogPost = {
  slug: 'serra-da-canastra-o-que-fazer-em-sao-roque-de-minas',
  title: 'Serra da Canastra: o que fazer em São Roque de Minas',
  description:
    'Casca d’Anta por baixo e por cima, a nascente do São Francisco, queijo Canastra e o chapadão: um roteiro para conhecer a Canastra a partir de São Roque de Minas.',
  place: 'Serra da Canastra',
  cities: [{ slug: 'sao-roque-de-minas-mg', name: 'São Roque de Minas' }],
  publishedAt: '2026-11-20',
  status: 'rascunho',
  cover: commons({
    file: "Cachoeira_Casca_D'anta,_parte_baixa.jpg",
    hash: 'c/c5',
    alt: 'Cachoeira Casca d’Anta vista da parte baixa, caindo do paredão de pedra no meio do verde',
    credit: 'Gustavo Couto',
    license: 'CC BY-SA 4.0',
  }),
  blocks: [
    {
      type: 'p',
      text: 'A Serra da Canastra tem esse nome pelo formato: vista de longe, parece um baú (uma canastra) deitado sobre o vale. Lá em cima, num chapadão de campos abertos, nasce o Rio São Francisco. Poucos quilômetros depois, o rio despenca na **Cachoeira Casca d’Anta**, o cartão-postal da região. São Roque de Minas é a cidade mais perto da portaria principal do parque e a base mais prática para conhecer tudo isso.',
    },
    {
      type: 'facts',
      items: [
        { label: 'Onde fica', value: 'Sudoeste de Minas Gerais' },
        { label: 'Parque', value: 'Parque Nacional da Serra da Canastra, criado em 1972' },
        { label: 'Quanto tempo', value: 'Pelo menos 2 dias inteiros' },
        { label: 'Base', value: 'São Roque de Minas (portaria principal do parque)' },
      ],
    },
    { type: 'h2', text: 'Cachoeira Casca d’Anta, por baixo e por cima' },
    {
      type: 'p',
      text: 'É a primeira grande queda do São Francisco: **186 metros de queda livre**, num paredão de pedra. Dá para conhecer por dois lados, e vale fazer os dois.',
    },
    {
      type: 'list',
      items: [
        '**Parte baixa:** acesso fácil, com poços e prainhas formados depois da queda. Cabe em meio dia. O poço logo embaixo da cachoeira é perigoso para banho: fique nas prainhas.',
        '**Parte alta:** fica dentro do parque, no chapadão. A trilha até o topo tem cerca de 3,7 km e mostra o cânion por onde o rio desce a serra. Chegue cedo.',
      ],
    },
    {
      type: 'image',
      photo: commons({
        file: "Cachoeira_Casca_d'Anta_-_parte_de_cima.jpg",
        hash: 'c/c1',
        alt: 'Rio São Francisco correndo entre pedras na parte de cima da Casca d’Anta, com a serra ao fundo',
        credit: 'Discoverbrasil',
        license: 'CC BY-SA 4.0',
      }),
      caption:
        'Na parte de cima, o São Francisco ainda é um rio de pedras e poços, pouco antes da queda.',
    },
    { type: 'h2', text: 'Nascente do Rio São Francisco' },
    {
      type: 'p',
      text: 'A nascente histórica fica dentro do parque, no alto do chapadão, a cerca de 12 km de São Roque de Minas. É um lugar de água cristalina, marcado por uma imagem de São Francisco. Dá para combinar a nascente e a parte alta da Casca d’Anta no mesmo dia.',
    },
    {
      type: 'image',
      photo: commons({
        file: 'Nascente_do_Rio_São_Francisco_-_MG.jpg',
        hash: '1/1e',
        alt: 'Poço de água clara entre pedras e capim na nascente do Rio São Francisco',
        credit: 'Luiza Ribeiro',
        license: 'CC BY-SA 4.0',
      }),
      caption: 'A nascente do Velho Chico, no chapadão da Canastra.',
    },
    { type: 'h2', text: 'O chapadão e os bichos do cerrado' },
    {
      type: 'p',
      text: 'A estrada que cruza o parque passa por campos abertos a perder de vista. É ali que muita gente vê **tamanduá-bandeira, veado e até lobo-guará**. Ande devagar, com binóculo à mão, de manhã cedo ou no fim da tarde.',
    },
    {
      type: 'image',
      photo: commons({
        file: 'PARNA_da_Serra_da_Canastra_-_Guiximenes(001).jpg',
        hash: '2/2e',
        alt: 'Paredão da Serra da Canastra visto do campo, com nuvens no céu',
        credit: 'Guilherme Ximenes C Dias',
        license: 'CC BY-SA 4.0',
      }),
      caption: 'O formato de baú que dá nome à serra.',
    },
    {
      type: 'tip',
      text: 'As estradas dentro do parque são de terra e, em vários trechos, ruins. Para a parte alta, muita gente vai de passeio 4×4 com guia local, saindo de São Roque de Minas.',
    },
    { type: 'h2', text: 'Queijo Canastra direto da fazenda' },
    {
      type: 'p',
      text: 'A região é a casa do **queijo Canastra**, e só pode levar esse nome o queijo feito ali. Os modos de fazer o Queijo Minas Artesanal entraram em 2024 na lista de patrimônio imaterial da UNESCO. Reserve uma tarde para visitar queijarias e provar direto de quem faz.',
    },
    { type: 'h2', text: 'Roteiro de 2 dias' },
    {
      type: 'list',
      items: [
        '**Dia 1:** parte alta do parque — nascente do São Francisco de manhã, trilha até o topo da Casca d’Anta à tarde.',
        '**Dia 2:** parte baixa da Casca d’Anta, banho nas prainhas e, no fim do dia, queijarias.',
        '**Com mais um dia:** outras cachoeiras do parque, como a do Fundão, ou o lado de Delfinópolis.',
      ],
    },
  ],
  faq: [
    {
      question: 'Qual a melhor cidade para ficar na Serra da Canastra?',
      answer:
        'Para a nascente do São Francisco e a Casca d’Anta, São Roque de Minas é a base mais prática: fica perto da portaria principal do parque. Vargem Bonita também é uma opção para a parte baixa da cachoeira.',
    },
    {
      question: 'Quantos dias ficar na Serra da Canastra?',
      answer:
        'Pelo menos 2 dias inteiros: um para a parte alta (nascente e topo da Casca d’Anta) e outro para a parte baixa da cachoeira e as queijarias.',
    },
    {
      question: 'Precisa de carro 4×4?',
      answer:
        'Para a parte alta, a estrada do parque é de terra e ruim em vários trechos. Muita gente faz esse dia com passeio 4×4 e guia local, e usa carro comum no resto.',
    },
  ],
}
