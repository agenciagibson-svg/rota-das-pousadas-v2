import type { PriceBreakdown } from './types'

/**
 * Taxa de serviço da plataforma — **desativada** (RB-23 revisada em 13/09/2026).
 *
 * A Rota é SaaS por assinatura: a receita vem do plano pago pela pousada, não de
 * comissão sobre reserva. O hóspede paga exatamente o preço definido pela
 * pousada, e o dinheiro vai direto para ela — a plataforma não entra na
 * transação (ver `docs/04_BUSINESS_ARCHITECTURE.md §9`).
 *
 * Mantido como constante zerada, e não removido, porque `bookings.fee` continua
 * existindo no banco: reservas anteriores a esta data guardam a taxa que foi
 * efetivamente cobrada e esse histórico não é reescrito.
 */
export const SERVICE_FEE_RATE = 0

/** Número de noites entre duas datas ISO (YYYY-MM-DD). Nunca negativo. */
export function nightsBetween(checkin: string, checkout: string): number {
  const a = new Date(`${checkin}T00:00:00Z`).getTime()
  const b = new Date(`${checkout}T00:00:00Z`).getTime()
  if (Number.isNaN(a) || Number.isNaN(b)) return 0
  return Math.max(0, Math.round((b - a) / 86_400_000))
}

/**
 * Cálculo puro de preço da reserva: (diária × noites), ajustado por
 * desconto/acréscimo/serviços previstos (Ciclo 4). Determinístico
 * e testável — a fonte da verdade do preço exibido e persistido como
 * snapshot na reserva (nunca recalculado a partir do cadastro atual depois).
 */
export function calculateBookingPrice(
  nightly: number,
  checkin: string,
  checkout: string,
  adjustments: { discount?: number; surcharge?: number; servicesAmount?: number } = {},
): PriceBreakdown {
  const nights = nightsBetween(checkin, checkout)
  const subtotal = nightly * nights
  const fee = Math.round(subtotal * SERVICE_FEE_RATE)
  const discount = Math.max(0, adjustments.discount ?? 0)
  const surcharge = Math.max(0, adjustments.surcharge ?? 0)
  const servicesAmount = Math.max(0, adjustments.servicesAmount ?? 0)
  const total = subtotal + fee - discount + surcharge + servicesAmount
  return {
    nights,
    nightly,
    subtotal,
    fee,
    discount,
    surcharge,
    servicesAmount,
    total: Math.max(0, total),
  }
}

/**
 * Cotação da estadia feita no servidor (0087: soma noite a noite com as
 * tarifas de temporada). O cliente nunca recalcula a temporada: só mostra o
 * total quando a cotação é das mesmas datas que estão na tela.
 */
export type StayQuote = {
  checkin: string
  checkout: string
  nights: number
  total: number
  /** Estadia mínima para essas datas (1 sem regra). */
  minNights: number
}

/** A cotação vale para as datas que a pessoa está vendo agora? */
export function quoteMatches(
  quote: StayQuote | null | undefined,
  checkin: string,
  checkout: string,
): quote is StayQuote {
  return Boolean(quote && quote.checkin === checkin && quote.checkout === checkout)
}

/** Diária média da estadia (para "R$ X × N noites" quando a temporada muda o valor). */
export function averageNightly(quote: StayQuote): number {
  return quote.nights > 0 ? Math.round(quote.total / quote.nights) : 0
}
