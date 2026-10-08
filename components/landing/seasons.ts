import { isoDateInTimeZone } from '@/lib/dates'

/**
 * Estações da "home viva": conteúdo do hero e utilitários de data usados pelo
 * hero e pelas ofertas da estação. Os textos são os mesmos de antes; o título
 * só foi dividido em duas partes para a segunda linha sair em peso leve.
 */
export type SeasonKey = 'verao' | 'outono' | 'inverno' | 'primavera'

export const seasonOrder: SeasonKey[] = ['verao', 'outono', 'inverno', 'primavera']

export const seasons: Record<
  SeasonKey,
  {
    label: string
    /** [primeira linha, segunda linha (peso leve)] — juntas formam o título original. */
    headline: [string, string]
    sub: string
    tags: string[]
    image: string
    alt: string
  }
> = {
  verao: {
    label: 'Verão',
    headline: ['Águas cristalinas', 'e dias infinitos'],
    sub: 'Praias, piscinas, cachoeiras e esportes aquáticos esperam por você.',
    tags: ['Praia', 'Piscina', 'Cachoeiras', 'Ilhas'],
    image: '/images/noronha.png',
    alt: 'Praia brasileira com mar azul para viagens de verao',
  },
  outono: {
    label: 'Outono',
    headline: ['Tons dourados', 'e o ritmo bom do campo'],
    sub: 'Fazendas, vinhedos e trilhas sob a luz mais bonita do ano.',
    tags: ['Fazenda', 'Vinhos', 'Trilhas', 'Natureza'],
    image: '/images/canastra.png',
    alt: 'Paisagem de serra e natureza para viagens de outono',
  },
  inverno: {
    label: 'Inverno',
    headline: ['Lareiras acesas', 'e refúgios de serra'],
    sub: 'Chalés, vinhos e destinos de montanha para aquecer a alma.',
    tags: ['Chalés', 'Lareira', 'Serra', 'Vinhos'],
    image: '/images/gramado.png',
    alt: 'Destino de inverno com arquitetura aconchegante na serra',
  },
  primavera: {
    label: 'Primavera',
    headline: ['A natureza floresce,', 'e você também'],
    sub: 'Ecoturismo, jardins e pousadas em meio ao verde renascido.',
    tags: ['Ecoturismo', 'Flores', 'Natureza', 'Bem-estar'],
    image: '/images/hero.png',
    alt: 'Pousada em meio a natureza verde ao nascer do sol',
  },
}

export const surpriseRoutes: Record<SeasonKey, string[]> = {
  verao: ['Praia', 'Piscina', 'Cachoeiras', 'Noronha', 'Capitólio', 'Bonito'],
  outono: ['Natureza', 'Fazenda', 'Trilhas', 'Canastra', 'Vista', 'Ecoturismo'],
  inverno: ['Serra', 'Lareira', 'Chalés', 'Gramado', 'Monte Verde', 'Românticos'],
  primavera: ['Ecoturismo', 'Flores', 'Natureza', 'Bem-estar', 'Bonito', 'Canastra'],
}

export function getCurrentBrazilSeason(date = new Date()): SeasonKey {
  const month = date.getMonth() + 1
  const day = date.getDate()
  const numericDate = month * 100 + day

  if (numericDate >= 1221 || numericDate < 320) return 'verao'
  if (numericDate >= 320 && numericDate < 621) return 'outono'
  if (numericDate >= 621 && numericDate < 923) return 'inverno'
  return 'primavera'
}

export function addDays(date: string, days: number): string {
  const next = new Date(`${date}T00:00:00Z`)
  next.setUTCDate(next.getUTCDate() + days)
  return next.toISOString().slice(0, 10)
}

/** Hoje em Brasília: em UTC a data do site virava a de amanhã às 21h. */
export function todayIso(): string {
  return isoDateInTimeZone(new Date())
}

/** 2026-10-09 → 09/10 (resumo das datas na busca do celular). */
export function shortDate(iso: string): string {
  const [, month, day] = iso.split('-')
  return `${day}/${month}`
}
