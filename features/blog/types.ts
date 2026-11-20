/** Foto de um texto do blog, sempre com crédito e licença. */
export type BlogPhoto = {
  src: string
  alt: string
  credit: string
  /** Ex.: "CC BY-SA 4.0" ou "Licença Unsplash". */
  license: string
  /** Página da foto (Wikimedia Commons, Unsplash). */
  sourceUrl: string
}

/**
 * Blocos do texto. Parágrafos e itens aceitam **negrito** e [link](/caminho).
 */
export type BlogBlock =
  | { type: 'p'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'image'; photo: BlogPhoto; caption?: string }
  | { type: 'tip'; text: string }
  | { type: 'facts'; items: { label: string; value: string }[] }

export type BlogPost = {
  slug: string
  title: string
  /** Resumo para o Google e para o card (até ~160 caracteres). */
  description: string
  cover: BlogPhoto
  /** Cidades do texto (slug de /destinos/<cidade-uf> e nome): "Onde ficar" e links. */
  cities: { slug: string; name: string }[]
  /** Nome da região para os títulos ("Serra da Canastra"). */
  place: string
  /** AAAA-MM-DD. */
  publishedAt: string
  updatedAt?: string
  /** Rascunho só aparece na versão de teste da Vercel (para aprovação). */
  status: 'rascunho' | 'publicado'
  blocks: BlogBlock[]
  faq?: { question: string; answer: string }[]
}
