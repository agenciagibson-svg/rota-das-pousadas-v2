/**
 * Fotos do banco de imagens Unsplash (licença Unsplash: uso comercial livre,
 * sem atribuição obrigatória — créditos em docs/creditos-imagens.md). Servidas
 * pela otimização de imagens do Next (`images.unsplash.com` liberado em
 * next.config.mjs), que entrega o tamanho e o formato certos para cada tela.
 */
const base = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=2400&q=80`

/** Fotos extras do hero, duas por estação (a terceira é a foto local original). */
export const seasonStock = {
  verao: [
    {
      src: base('photo-1521495611528-1d6a473a3da1'),
      alt: 'Vista aérea de praia com mar azul-turquesa e morros verdes',
    },
    {
      src: base('photo-1620045819541-66ad1cf09e07'),
      alt: 'Praia com mar verde e mata atlântica sob céu azul',
    },
  ],
  outono: [
    {
      src: base('photo-1504279577054-acfeccf8fc52'),
      alt: 'Fileiras de vinhedo sob a luz dourada do fim de tarde',
    },
    { src: base('photo-1558138818-34316d616e44'), alt: 'Vinhedo em colinas ao entardecer' },
  ],
  inverno: [
    {
      src: base('photo-1786384618389-0be60f14d73b'),
      alt: 'Casa de campo com janelas acesas sob montanhas com neblina',
    },
    {
      src: base('photo-1712669869857-c9c0c098d024'),
      alt: 'Sala de chalé com lareira acesa e manta sobre o sofá',
    },
  ],
  primavera: [
    {
      src: base('photo-1755464314317-b1f37a285c10'),
      alt: 'Jardim florido com tulipas e jacintos coloridos',
    },
    { src: base('photo-1605043039319-7bf9fa57922f'), alt: 'Cachoeira entre a mata verde' },
  ],
} as const

/** Fotos das seis pousadas novas do catálogo de demonstração (capa primeiro). */
export const pousadaStock = {
  mareAlta: [
    base('photo-1635511759154-a928f931fdd7'),
    base('photo-1645378975326-7339786fdec3'),
    base('photo-1679242158095-5404d2e7bc16'),
    base('photo-1731336478850-6bce7235e320'),
    base('photo-1641934891606-18054bf48c5a'),
  ],
  pontaAzul: [
    base('photo-1717361054046-eda52d552736'),
    base('photo-1776761731034-248be1b3184d'),
    base('photo-1760564019141-abe33455ce02'),
    base('photo-1760067537740-faa11f7bdf1e'),
    base('photo-1728051104003-aa16971b44b3'),
  ],
  cabanasDaMata: [
    base('photo-1703782997454-8eb0d4d94e9c'),
    base('photo-1780151528525-432e778ff799'),
    base('photo-1763051339093-61c59f40ba28'),
    base('photo-1610019588004-c3a24e9cf073'),
    base('photo-1734456416941-416c08f0778e'),
  ],
  fazendaSerraAzul: [
    base('photo-1523745663588-1bfa973c9b35'),
    base('photo-1653007574344-20236976dc02'),
    base('photo-1773861540606-e5df23583620'),
    base('photo-1742614098768-c250f6227d21'),
    base('photo-1540304453527-62f979142a17'),
  ],
  ecolodgeRioNegro: [
    base('photo-1777863895689-3da81ec075e1'),
    base('photo-1598837218686-a456fdaa5cf3'),
    base('photo-1700753146836-7091d0b28635'),
    base('photo-1703778604688-0d7037716fd7'),
    base('photo-1588689653245-274f0cd2bfe9'),
  ],
  chalesSerraGelada: [
    base('photo-1728734281683-3cc76087f203'),
    base('photo-1531057228999-37933ba12c52'),
    base('photo-1712669869857-c9c0c098d024'),
    base('photo-1778483154286-625d6131cae5'),
    base('photo-1731336250970-dc942b5e0746'),
  ],
} as const
