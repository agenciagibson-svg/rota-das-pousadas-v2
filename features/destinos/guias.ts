/**
 * Guia editorial por cidade: foto de capa, frase de apresentação e passeios
 * com foto. Entra na página `/destinos/<cidade-uf>` quando a cidade tem
 * pousada publicada. Cidade sem guia mostra só os dados das pousadas.
 *
 * Fotos: banco Unsplash (licença Unsplash: uso comercial livre, sem atribuição
 * obrigatória). Cada foto foi conferida na página dela como tirada na cidade.
 * Créditos em docs/creditos-imagens.md e no rodapé da seção.
 *
 * Para acrescentar uma cidade: chave = slug da cidade (`citySlug`), fotos com
 * local confirmado, textos só com fatos verificáveis (sem horário nem preço,
 * que mudam).
 */

export type GuidePhoto = {
  src: string
  alt: string
  /** Fotógrafo, para o crédito. */
  credit: string
}

export type GuideHighlight = {
  title: string
  text: string
  photo: GuidePhoto
}

export type CityGuide = {
  hero: GuidePhoto
  /** Frase curta sob o título. */
  tagline: string
  highlights: GuideHighlight[]
  /** Outros passeios, sem foto. */
  alsoWorth: string[]
}

const unsplash = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=2400&q=80`

export const CITY_GUIDES: Record<string, CityGuide> = {
  'tiradentes-mg': {
    hero: {
      src: unsplash('photo-1642894538682-ca7adc79caa8'),
      alt: 'Casario de Tiradentes com a Matriz de Santo Antônio no alto e a Serra de São José ao fundo',
      credit: 'Lohane Gonçalves Diogo',
    },
    tagline:
      'Cidade barroca aos pés da Serra de São José, com ruas de pedra, igrejas do século XVIII, ateliês e a melhor cozinha mineira.',
    highlights: [
      {
        title: 'Centro histórico',
        text: 'Ruas de pedra, casarões coloniais, ateliês e lojas de artesanato. Tudo perto, para conhecer a pé e sem pressa.',
        photo: {
          src: unsplash('photo-1632798121054-c6b73cc9e8b0'),
          alt: 'Rua de pedra em Tiradentes descendo entre casarões brancos, com a serra ao fundo',
          credit: 'Nathalia Segato',
        },
      },
      {
        title: 'Matriz de Santo Antônio',
        text: 'Igreja barroca do início do século XVIII, no ponto mais alto do centro. Do adro se vê a cidade inteira com a serra atrás.',
        photo: {
          src: unsplash('photo-1642894460497-7ce9cd5467d0'),
          alt: 'Fachada branca e dourada da Matriz de Santo Antônio, em Tiradentes',
          credit: 'Lohane Gonçalves Diogo',
        },
      },
      {
        title: 'Casarões coloridos',
        text: 'Portas e janelas pintadas, cafés, restaurantes de comida mineira e o clima de cidade pequena que faz o fim de semana render.',
        photo: {
          src: unsplash('photo-1642894481767-e62ebc91a125'),
          alt: 'Rua de pedra com casarões de portas e janelas coloridas em Tiradentes',
          credit: 'Lohane Gonçalves Diogo',
        },
      },
      {
        title: 'Serra de São José',
        text: 'A serra que emoldura a cidade tem trilhas com mirantes sobre o vale, como a Trilha do Carteiro, e cachoeiras nos arredores.',
        photo: {
          src: unsplash('photo-1623934832526-750b4a277b5d'),
          alt: 'Telhados de Tiradentes entre árvores, com a Serra de São José sob o céu azul',
          credit: 'Douglas Mendes',
        },
      },
    ],
    alsoWorth: [
      'Passeio de Maria Fumaça até São João del-Rei',
      'Festival Cultura e Gastronomia, em agosto',
      'Pontes de pedra e riachos que cortam o centro',
    ],
  },
}

export function cityGuide(slug: string): CityGuide | null {
  return CITY_GUIDES[slug] ?? null
}

/** Fotógrafos da página, sem repetição, para a linha de crédito. */
export function guideCredits(guide: CityGuide): string[] {
  return [...new Set([guide.hero.credit, ...guide.highlights.map((h) => h.photo.credit)])]
}
