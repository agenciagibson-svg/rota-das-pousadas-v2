import type { Destination, Pousada } from '@/types'
import { slugify } from '@/lib/slug'
import { formatPrice } from '@/lib/format'
import { ufName } from '@/lib/estados'
import { PET_TYPE, hasStayType } from '@/features/pousadas/amenities'

/**
 * Páginas por destino (/destinos/<cidade-uf>).
 *
 * O destino nasce da cidade e do estado que a própria pousada cadastrou: basta
 * uma pousada publicada em Tiradentes (MG) para existir
 * `/destinos/tiradentes-mg`. Nada de lista curada à parte — a tabela
 * `destinations` (mosaico da home) depende de alguém ligar cada pousada a um
 * destino, e ninguém liga; a página ficaria vazia.
 *
 * Todo texto da página sai dos dados reais das pousadas. Sem pousada, sem
 * página (404): página vazia indexada derruba o site no Google.
 */

export type CityDestination = {
  slug: string
  city: string
  state: string
  pousadas: Pousada[]
  /** Menor diária entre as pousadas (0 quando nenhuma informou preço). */
  priceFrom: number
  priceTo: number
  /** Média ponderada pelas avaliações; `null` sem nenhuma avaliação. */
  rating: number | null
  reviews: number
  image: string
  /** Comodidades mais comuns, da mais frequente para a menos. */
  topTags: string[]
}

export type FaqItem = { question: string; answer: string }

export function citySlug(city: string, state: string): string {
  return slugify(`${city} ${state}`)
}

/** `/destinos/<cidade-uf>` da cidade de uma pousada. */
export function destinationPath(city: string, state: string): string {
  return `/destinos/${citySlug(city, state)}`
}

function mostCommon(values: string[]): string {
  const counts = new Map<string, number>()
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
  let best = values[0] ?? ''
  for (const [v, n] of counts) if (n > (counts.get(best) ?? 0)) best = v
  return best
}

function topTags(pousadas: Pousada[], limit = 6): string[] {
  const counts = new Map<string, { label: string; n: number }>()
  for (const p of pousadas) {
    const seen = new Set<string>()
    for (const tag of p.tags) {
      const key = slugify(tag)
      if (!key || seen.has(key)) continue
      seen.add(key)
      const entry = counts.get(key)
      if (entry) entry.n += 1
      else counts.set(key, { label: tag.trim(), n: 1 })
    }
  }
  return [...counts.values()]
    .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label, 'pt-BR'))
    .slice(0, limit)
    .map((t) => t.label)
}

function summarize(slug: string, pousadas: Pousada[]): CityDestination {
  const prices = pousadas.map((p) => p.pricePerNight).filter((n) => n > 0)
  const reviewed = pousadas.filter((p) => p.reviews > 0)
  const reviews = reviewed.reduce((sum, p) => sum + p.reviews, 0)
  const rating =
    reviews > 0
      ? Math.round((reviewed.reduce((sum, p) => sum + p.rating * p.reviews, 0) / reviews) * 10) / 10
      : null
  const ordered = [...pousadas].sort(
    (a, b) => b.reviews - a.reviews || b.rating - a.rating || a.name.localeCompare(b.name, 'pt-BR'),
  )
  return {
    slug,
    city: mostCommon(pousadas.map((p) => p.city.trim())),
    state: mostCommon(pousadas.map((p) => p.state.trim().toUpperCase())),
    pousadas: ordered,
    priceFrom: prices.length ? Math.min(...prices) : 0,
    priceTo: prices.length ? Math.max(...prices) : 0,
    rating,
    reviews,
    image: ordered.find((p) => p.image)?.image ?? '',
    topTags: topTags(pousadas),
  }
}

/**
 * Agrupa as pousadas publicadas por cidade + UF. Grafias diferentes da mesma
 * cidade ("São Thomé" e "sao thomé") caem no mesmo destino porque o slug ignora
 * acento e caixa. Pousada sem cidade ou UF fica de fora.
 */
export function groupByCity(pousadas: Pousada[]): CityDestination[] {
  const groups = new Map<string, Pousada[]>()
  for (const p of pousadas) {
    if (!p.city?.trim() || !p.state?.trim()) continue
    const slug = citySlug(p.city.trim(), p.state.trim())
    if (!slug) continue
    groups.set(slug, [...(groups.get(slug) ?? []), p])
  }
  return [...groups.entries()]
    .map(([slug, list]) => summarize(slug, list))
    .sort((a, b) => b.pousadas.length - a.pousadas.length || a.city.localeCompare(b.city, 'pt-BR'))
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? `1 ${one}` : `${n} ${many}`
}

function listJoin(items: string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`
}

export function destinationTitle(d: CityDestination): string {
  return `Pousadas em ${d.city}, ${d.state}`
}

export function destinationDescription(d: CityDestination): string {
  const count = plural(d.pousadas.length, 'pousada', 'pousadas')
  const price = d.priceFrom > 0 ? ` Diárias a partir de ${formatPrice(d.priceFrom)}.` : ''
  return `${count} em ${d.city} (${d.state}) com reserva direta, sem intermediário.${price} Pague com Pix ou cartão.`
}

/** Parágrafo de abertura da página, só com fatos das pousadas cadastradas. */
export function destinationIntro(d: CityDestination): string {
  const parts = [
    `Na Rota das Pousadas você encontra ${plural(d.pousadas.length, 'pousada', 'pousadas')} em ${d.city} (${d.state}) e reserva direto com quem recebe você, sem intermediário.`,
  ]
  if (d.priceFrom > 0) {
    parts.push(
      d.priceTo > d.priceFrom
        ? `As diárias vão de ${formatPrice(d.priceFrom)} a ${formatPrice(d.priceTo)}.`
        : `A diária sai a partir de ${formatPrice(d.priceFrom)}.`,
    )
  }
  if (d.topTags.length) {
    parts.push(`Entre o que as pousadas oferecem: ${listJoin(d.topTags.slice(0, 4))}.`)
  }
  return parts.join(' ')
}

/** Perguntas frequentes — cada resposta vem dos dados, nunca de suposição. */
export function destinationFaq(d: CityDestination): FaqItem[] {
  const names = d.pousadas.map((p) => p.name)
  const faq: FaqItem[] = [
    {
      question: `Quantas pousadas em ${d.city} estão na Rota das Pousadas?`,
      answer:
        d.pousadas.length === 1
          ? `Hoje há 1 pousada em ${d.city}: ${names[0]}.`
          : `Hoje há ${d.pousadas.length} pousadas em ${d.city}: ${listJoin(names.slice(0, 8))}${names.length > 8 ? ', entre outras' : ''}.`,
    },
  ]
  if (d.priceFrom > 0) {
    faq.push({
      question: `Quanto custa a diária de uma pousada em ${d.city}?`,
      answer:
        d.priceTo > d.priceFrom
          ? `As diárias começam em ${formatPrice(d.priceFrom)} e chegam a ${formatPrice(d.priceTo)}, conforme a pousada e a acomodação. O valor final aparece antes de você confirmar a reserva.`
          : `A diária sai a partir de ${formatPrice(d.priceFrom)}. O valor final aparece antes de você confirmar a reserva.`,
    })
  }
  const pets = d.pousadas.filter((p) => hasStayType(p, PET_TYPE)).map((p) => p.name)
  if (pets.length) {
    faq.push({
      question: `Tem pousada em ${d.city} que aceita pet?`,
      answer: `Sim: ${listJoin(pets)}. Confirme as regras para o seu pet na página da pousada antes de reservar.`,
    })
  }
  const best = d.pousadas.filter((p) => p.reviews > 0).slice(0, 3)
  if (best.length) {
    faq.push({
      question: `Quais pousadas em ${d.city} têm as melhores avaliações?`,
      answer: `${listJoin(best.map((p) => `${p.name} (nota ${p.rating.toFixed(1)} em ${plural(p.reviews, 'avaliação', 'avaliações')})`))}. As avaliações são de hóspedes que reservaram pela Rota.`,
    })
  }
  faq.push({
    question: `Como reservar uma pousada em ${d.city}?`,
    answer:
      'Escolha a pousada, veja as acomodações e as datas livres e reserve pela própria página. A reserva é direta com a pousada, sem intermediário, e o pagamento é por Pix ou cartão.',
  })
  return faq
}

/**
 * Mosaico da home: o destino curado que tem página de cidade passa a levar
 * para ela, com contagem, preço e nota das pousadas de verdade. Sem página, o
 * card fica como está (sem contagem nem nota).
 */
export function withCityPages(curated: Destination[], cities: CityDestination[]): Destination[] {
  const bySlug = new Map(cities.map((c) => [c.slug, c]))
  return curated.map((d) => {
    const city = bySlug.get(citySlug(d.name, d.state))
    if (!city) return { ...d, pousadas: 0 }
    return {
      ...d,
      href: `/destinos/${city.slug}`,
      pousadas: city.pousadas.length,
      priceFrom: city.priceFrom,
      rating: city.rating ?? 0,
    }
  })
}

/**
 * Foto da cidade: vem do destino cadastrado no /admin → Destinos com o mesmo
 * nome e UF. Sem cadastro, a página não usa foto de pousada como se fosse a
 * cidade — fica sem foto de capa.
 */
export function cityPhoto(city: CityDestination, curated: Destination[]): string | null {
  const match = curated.find((d) => citySlug(d.name, d.state) === city.slug)
  return match?.image?.trim() ? match.image : null
}

// ---------------------------------------------------------------------------
// Páginas por estado (/destinos/<uf>, ex.: /destinos/mg)
// ---------------------------------------------------------------------------

export type StateDestination = {
  /** UF em minúsculas — o slug da página. */
  slug: string
  uf: string
  name: string
  cities: CityDestination[]
  pousadas: number
  priceFrom: number
}

/** Slug de estado: só as duas letras. Cidade sempre termina em `-uf`. */
export function isStateSlug(slug: string): boolean {
  return /^[a-z]{2}$/.test(slug) && ufName(slug) !== null
}

/** A página do estado só vai para o Google com 2+ cidades; com uma, repetiria a da cidade. */
export function stateIndexable(s: StateDestination): boolean {
  return s.cities.length >= 2
}

export function groupByState(cities: CityDestination[]): StateDestination[] {
  const byUf = new Map<string, CityDestination[]>()
  for (const c of cities) {
    if (!ufName(c.state)) continue
    byUf.set(c.state, [...(byUf.get(c.state) ?? []), c])
  }
  return [...byUf.entries()]
    .map(([uf, list]) => {
      const prices = list.map((c) => c.priceFrom).filter((n) => n > 0)
      return {
        slug: uf.toLowerCase(),
        uf,
        name: ufName(uf)!,
        cities: list,
        pousadas: list.reduce((n, c) => n + c.pousadas.length, 0),
        priceFrom: prices.length ? Math.min(...prices) : 0,
      }
    })
    .sort((a, b) => b.pousadas - a.pousadas || a.name.localeCompare(b.name, 'pt-BR'))
}

export function stateTitle(s: StateDestination): string {
  return `Pousadas em ${s.name}`
}

export function stateDescription(s: StateDestination): string {
  const price = s.priceFrom > 0 ? ` Diárias a partir de ${formatPrice(s.priceFrom)}.` : ''
  return `${plural(s.pousadas, 'pousada', 'pousadas')} em ${plural(s.cities.length, 'cidade', 'cidades')} de ${s.name} com reserva direta, sem intermediário.${price}`
}

export function stateIntro(s: StateDestination): string {
  const names = s.cities.map((c) => c.city)
  const parts = [
    `Na Rota das Pousadas você encontra ${plural(s.pousadas, 'pousada', 'pousadas')} em ${s.name}, em ${listJoin(names.slice(0, 6))}${names.length > 6 ? ' e outras cidades' : ''}.`,
  ]
  if (s.priceFrom > 0) parts.push(`As diárias começam em ${formatPrice(s.priceFrom)}.`)
  parts.push('Escolha a cidade e reserve direto com a pousada.')
  return parts.join(' ')
}
