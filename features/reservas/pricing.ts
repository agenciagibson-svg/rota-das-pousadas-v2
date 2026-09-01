import type { PriceBreakdown } from './types'

/** Taxa de serviço da plataforma (RB-23). */
export const SERVICE_FEE_RATE = 0.08

/** Número de noites entre duas datas ISO (YYYY-MM-DD). Nunca negativo. */
export function nightsBetween(checkin: string, checkout: string): number {
  const a = new Date(`${checkin}T00:00:00Z`).getTime()
  const b = new Date(`${checkout}T00:00:00Z`).getTime()
  if (Number.isNaN(a) || Number.isNaN(b)) return 0
  return Math.max(0, Math.round((b - a) / 86_400_000))
}

/**
 * Cálculo puro de preço da reserva: (diária × noites) + taxa de serviço,
 * ajustado por desconto/acréscimo/serviços previstos (Ciclo 4). Determinístico
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
  return { nights, nightly, subtotal, fee, discount, surcharge, servicesAmount, total: Math.max(0, total) }
}
