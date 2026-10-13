import type { Pousada } from '@/types'
import { normalizeSearch } from '../recommendations'
import { INTENTS, nightsBetween, type Criteria, type IntentKey } from './criteria'

/** Pousada encontrada pelo concierge, com o porquê de ter combinado. */
export type ConciergeMatch = {
  pousada: Pousada
  score: number
  /** Rótulos das intenções que a pousada atende (ex.: "praia", "pets"). */
  reasons: string[]
  /** Intenções pedidas que ela não atende — o concierge pode avisar. */
  missing: string[]
  capacity: number
  fitsGroup: boolean
  withinBudget: boolean
}

export const DEFAULT_CAPACITY = 4

function pousadaText(p: Pousada): string {
  return normalizeSearch(`${p.name} ${p.city} ${p.state} ${p.description} ${p.tags.join(' ')}`)
}

function textHas(text: string, phrase: string): boolean {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^a-z0-9])${escaped}`).test(text)
}

/**
 * Busca no catálogo publicado. Cidade ou nome citados pela pessoa filtram;
 * região/UF filtram; grupo maior que a acomodação sai; orçamento pesa.
 */
export function searchCatalog(
  pousadas: Pousada[],
  criteria: Pick<Criteria, 'intents' | 'guests' | 'maxPrice' | 'states' | 'text'>,
  limit = 3,
): ConciergeMatch[] {
  const placeHits = pousadas.filter((p) => {
    const city = normalizeSearch(p.city)
    const name = normalizeSearch(p.name)
    return (city.length > 3 && textHas(criteria.text, city)) || textHas(criteria.text, name)
  })
  let pool = placeHits.length ? placeHits : pousadas
  if (criteria.states.length) {
    const inRegion = pool.filter((p) => criteria.states.includes(p.state))
    if (inRegion.length) pool = inRegion
  }

  const results: ConciergeMatch[] = pool.map((pousada) => {
    const text = pousadaText(pousada)
    const tags = normalizeSearch(pousada.tags.join(' | '))
    let tagBonus = 0
    const reasons: string[] = []
    const missing: string[] = []
    for (const key of criteria.intents) {
      const intent = INTENTS[key as IntentKey]
      if (intent.match.some((m) => textHas(text, m))) {
        reasons.push(intent.label)
        // Destaque cadastrado pela pousada vale mais que menção na descrição.
        if (intent.match.some((m) => textHas(tags, m))) tagBonus += 15
      } else missing.push(intent.label)
    }
    const capacity = pousada.maxGuests ?? DEFAULT_CAPACITY
    const fitsGroup = criteria.guests == null || criteria.guests <= capacity
    const withinBudget = criteria.maxPrice == null || pousada.pricePerNight <= criteria.maxPrice
    let score =
      reasons.length * 30 + tagBonus + pousada.rating * 8 + Math.min(pousada.reviews, 300) / 30
    if (placeHits.includes(pousada)) score += 40
    if (!withinBudget) score -= Math.min(40, (pousada.pricePerNight - criteria.maxPrice!) / 10)
    if (!fitsGroup) score -= 1000
    return { pousada, score, reasons, missing, capacity, fitsGroup, withinBudget }
  })

  return results
    .filter((r) => r.fitsGroup)
    .filter((r) => criteria.intents.length === 0 || r.reasons.length > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

/** Links do caminho até a reserva, montados no servidor (nunca pelo modelo). */
export function bookingLinks(
  slug: string,
  stay: { checkin?: string | null; checkout?: string | null; guests?: number | null },
) {
  const params = new URLSearchParams()
  if (stay.checkin && stay.checkout) {
    params.set('checkin', stay.checkin)
    params.set('checkout', stay.checkout)
  }
  if (stay.guests) params.set('guests', String(stay.guests))
  const query = params.toString()
  const page = `/pousada/${slug}${query ? `?${query}` : ''}`
  const reserve = stay.checkin && stay.checkout ? `/pousada/${slug}/reservar?${query}` : null
  return { page, reserve }
}

export function estimateTotal(pricePerNight: number, checkin: string, checkout: string) {
  const nights = nightsBetween(checkin, checkout)
  return { nights, total: nights * pricePerNight }
}
