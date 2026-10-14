import type { Pousada } from '@/types'
import { formatPrice } from '@/lib/format'
import { normalizeSearch } from '../recommendations'
import { extractCriteria, INTENTS, nightsBetween, type Criteria } from './criteria'
import { bookingLinks, estimateTotal, searchCatalog, type ConciergeMatch } from './search'
import type { ChatMessage, ConciergeCard, ConciergeReply } from './types'

/**
 * Concierge sem IA externa: entende as palavras-chave, busca no catálogo e
 * conduz a conversa até a reserva (estilo → pessoas → datas → reservar).
 * É o modo usado sem `OPENAI_API_KEY` e o plano B se a OpenAI falhar.
 */

export const STARTER_REPLIES = [
  'Praia com a família',
  'Cabana na floresta',
  'Resort no Nordeste',
  'Serra com lareira a dois',
  'Viagem com pets',
]

function ddmm(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function listJoin(items: string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} e ${items.at(-1)}`
}

export function toCard(
  match: ConciergeMatch,
  stay: { checkin?: string | null; checkout?: string | null; guests?: number | null },
): ConciergeCard {
  const { pousada } = match
  const links = bookingLinks(pousada.slug, stay)
  const estimate =
    stay.checkin && stay.checkout
      ? estimateTotal(pousada.pricePerNight, stay.checkin, stay.checkout)
      : null
  return {
    slug: pousada.slug,
    name: pousada.name,
    city: pousada.city,
    state: pousada.state,
    image: pousada.image,
    pricePerNight: pousada.pricePerNight,
    rating: pousada.rating,
    reviews: pousada.reviews,
    tags: pousada.tags.slice(0, 3),
    reasons: match.reasons,
    capacity: match.capacity,
    pageHref: links.page,
    reserveHref: links.reserve,
    nights: estimate?.nights ?? null,
    total: estimate?.total ?? null,
  }
}

/** Respostas rápidas conforme o que ainda falta saber. */
export function suggestQuickReplies(c: Criteria, today: string): string[] {
  const hasStyle = c.intents.length > 0 || c.states.length > 0
  if (!hasStyle) return STARTER_REPLIES
  if (c.guests == null) return ['Somos 2', 'Somos 4', '2 adultos e 2 crianças', 'Vamos com pet']
  if (!c.dates) {
    const in30 = addDays(today, 30)
    return ['Próximo fim de semana', `${ddmm(in30)} a ${ddmm(addDays(in30, 3))}`, '3 noites']
  }
  return ['Ver mais opções', 'Mudar as datas', 'Somos mais pessoas']
}

export function localConcierge(
  messages: ChatMessage[],
  pousadas: Pousada[],
  today: string,
): ConciergeReply {
  const userTexts = messages.filter((m) => m.role === 'user').map((m) => m.content)
  const c = extractCriteria(userTexts, today)
  const quickReplies = suggestQuickReplies(c, today)
  const last = (userTexts.at(-1) ?? '').toLowerCase()
  const wantsMore = /mais op|outras|outra op/.test(last)

  const all = searchCatalog(pousadas, c, wantsMore ? 6 : 3)
  const matches = wantsMore && all.length > 3 ? all.slice(3) : all
  const placeMentioned = pousadas.some((p) =>
    [p.city, p.name].some((n) => n.length > 3 && c.text.includes(normalizeSearch(n))),
  )

  if (!c.intents.length && !c.states.length && !placeMentioned) {
    return {
      reply:
        'Oi! Sou o concierge da Rota. Me conta o clima da viagem — praia, serra, floresta, cabana, resort, fazenda? Vai a dois, com a família ou com pets? Com isso eu já separo as pousadas que combinam.',
      cards: [],
      quickReplies,
      engine: 'local',
    }
  }

  const understood = c.intents.length
    ? `Entendi: ${listJoin(c.intents.map((k) => INTENTS[k].label))}`
    : 'Entendi'
  const group = c.guests ? ` para ${c.guests} ${c.guests === 1 ? 'pessoa' : 'pessoas'}` : ''

  if (!matches.length) {
    return {
      reply: `${understood}${group}. Não encontrei uma pousada que atenda tudo isso no catálogo agora. Quer tirar algum item (como orçamento ou região) ou tentar outro estilo?`,
      cards: [],
      quickReplies: STARTER_REPLIES,
      engine: 'local',
    }
  }

  if (c.dates && c.dates.checkin < today) {
    return {
      reply: 'Essa data já passou. Para quando seria a viagem? Pode escrever “20/12 a 23/12”.',
      cards: [],
      quickReplies,
      engine: 'local',
    }
  }

  const stay = { checkin: c.dates?.checkin, checkout: c.dates?.checkout, guests: c.guests }
  const cards = matches.map((m) => toCard(m, stay))

  if (c.guests == null) {
    return {
      reply: `${understood}. Separei ${cards.length === 1 ? 'uma opção que combina' : `${cards.length} opções que combinam`}. Quantas pessoas vão? Se tiver criança ou pet, me conta também.`,
      cards,
      quickReplies,
      engine: 'local',
    }
  }

  if (!c.dates) {
    const nights = c.nights ? ` (${c.nights} ${c.nights === 1 ? 'noite' : 'noites'})` : ''
    return {
      reply: `${understood}${group}. Estas cabem no grupo. Para quais datas${nights}? Pode escrever “20/12 a 23/12” ou “fim de semana”.`,
      cards,
      quickReplies,
      engine: 'local',
    }
  }

  const nights = nightsBetween(c.dates.checkin, c.dates.checkout)
  const best = cards[0]!
  const reasons = best.reasons.length ? ` (${listJoin(best.reasons)})` : ''
  return {
    reply: `Prontinho! ${nights} ${nights === 1 ? 'noite' : 'noites'}, de ${ddmm(c.dates.checkin)} a ${ddmm(c.dates.checkout)}${group}. Minha sugestão é a ${best.name}${reasons}: ${formatPrice(best.total ?? 0)} no total. Toque em “Reservar agora” para garantir — o pagamento vem no passo seguinte.${cards.length > 1 ? ' As outras opções também estão abaixo.' : ''}`,
    cards,
    quickReplies,
    engine: 'local',
  }
}
