import type { Pousada } from '@/types'
import { slugify } from '@/lib/slug'

/**
 * Tipos de estadia reconhecidos nas comodidades (tags) que a pousada marca.
 * Usado nas perguntas frequentes da pousada e nas páginas por tipo
 * (`/pousadas/<tipo>`). A comparação é por palavra inteira, sem acento:
 * "Petiscos" não conta como pet, "Pet Friendly" conta.
 */
export type StayType = {
  slug: string
  /** Título da página: "Pousadas que aceitam pet". */
  title: string
  /** Frase curta para a abertura da página. */
  lead: string
  /** Palavras (já sem acento, minúsculas) — basta uma aparecer numa tag. */
  words: string[][]
}

export const STAY_TYPES: StayType[] = [
  {
    slug: 'aceita-pet',
    title: 'Pousadas que aceitam pet',
    lead: 'Viaje com o seu cachorro ou gato: estas pousadas recebem pets.',
    words: [['pet'], ['pets'], ['cachorro'], ['cachorros'], ['animais'], ['animal']],
  },
  {
    slug: 'com-piscina',
    title: 'Pousadas com piscina',
    lead: 'Pousadas com piscina para aproveitar o sol entre um passeio e outro.',
    words: [['piscina'], ['piscinas']],
  },
  {
    slug: 'com-cafe-da-manha',
    title: 'Pousadas com café da manhã',
    lead: 'Acorde com mesa posta: estas pousadas servem café da manhã.',
    words: [
      ['cafe', 'da', 'manha'],
      ['cafe', 'colonial'],
      ['cafe', 'mineiro'],
    ],
  },
  {
    slug: 'romanticas',
    title: 'Pousadas românticas',
    lead: 'Refúgios para casais: privacidade, conforto e clima de lua de mel.',
    words: [
      ['romantica'],
      ['romantico'],
      ['romanticas'],
      ['casal'],
      ['casais'],
      ['lua', 'de', 'mel'],
      ['hidromassagem'],
      ['ofuro'],
      ['banheira'],
    ],
  },
  {
    slug: 'para-familia',
    title: 'Pousadas para ir com a família',
    lead: 'Espaço para as crianças e conforto para todos: pousadas que recebem bem as famílias.',
    words: [['familia'], ['familias'], ['criancas'], ['crianca'], ['kids'], ['infantil']],
  },
  {
    slug: 'na-natureza',
    title: 'Pousadas na natureza',
    lead: 'Pousadas cercadas de verde, com trilhas, cachoeiras e silêncio.',
    words: [
      ['natureza'],
      ['cachoeira'],
      ['cachoeiras'],
      ['trilha'],
      ['trilhas'],
      ['mata'],
      ['fazenda'],
      ['ecoturismo'],
    ],
  },
]

function tagWords(tag: string): string[] {
  return slugify(tag).split('-').filter(Boolean)
}

/** A sequência `needle` aparece inteira dentro das palavras da tag. */
function containsSeq(words: string[], needle: string[]): boolean {
  for (let i = 0; i + needle.length <= words.length; i++) {
    if (needle.every((w, j) => words[i + j] === w)) return true
  }
  return false
}

export function hasStayType(pousada: Pick<Pousada, 'tags'>, type: StayType): boolean {
  return pousada.tags.some((tag) => {
    const words = tagWords(tag)
    return type.words.some((needle) => containsSeq(words, needle))
  })
}

export function stayType(slug: string): StayType | null {
  return STAY_TYPES.find((t) => t.slug === slug) ?? null
}

export const PET_TYPE = stayType('aceita-pet')!
export const BREAKFAST_TYPE = stayType('com-cafe-da-manha')!
export const POOL_TYPE = stayType('com-piscina')!

export type StayTypePage = {
  type: StayType
  pousadas: Pousada[]
  /** Cidades (slug, nome, UF) que têm pousada deste tipo. */
  cities: { slug: string; city: string; state: string; count: number }[]
}

/** Página do tipo vai para o Google só com 2+ pousadas; com 0, nem existe. */
export function stayTypeIndexable(page: StayTypePage): boolean {
  return page.pousadas.length >= 2
}

export function buildStayTypePages(
  pousadas: Pousada[],
  citySlugOf: (city: string, state: string) => string,
): StayTypePage[] {
  return STAY_TYPES.map((type) => {
    const list = pousadas
      .filter((p) => hasStayType(p, type))
      .sort((a, b) => b.reviews - a.reviews || b.rating - a.rating)
    const cities = new Map<string, { slug: string; city: string; state: string; count: number }>()
    for (const p of list) {
      if (!p.city?.trim() || !p.state?.trim()) continue
      const slug = citySlugOf(p.city.trim(), p.state.trim())
      const entry = cities.get(slug)
      if (entry) entry.count += 1
      else
        cities.set(slug, {
          slug,
          city: p.city.trim(),
          state: p.state.trim().toUpperCase(),
          count: 1,
        })
    }
    return {
      type,
      pousadas: list,
      cities: [...cities.values()].sort((a, b) => b.count - a.count),
    }
  }).filter((page) => page.pousadas.length > 0)
}
