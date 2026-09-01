import type { AccommodationStatus, AvailabilityReason, RoomOperationalStatus } from './types'

/**
 * Motor de disponibilidade — centralizado e puro (sem I/O), para não
 * calcular disponibilidade separadamente em cada tela (Ciclo 3, item 6).
 *
 * Só `maintenance`/`blocked` impedem disponibilidade FUTURA por status
 * operacional — `occupied`/`cleaning`/`awaiting_cleaning`/`inspection_pending`
 * são estados transitórios do momento atual que se resolvem antes de uma
 * data futura; não devem negar uma reserva daqui a 3 semanas só porque o
 * quarto está ocupado hoje. Conflito de reserva real é responsabilidade de
 * `hasBookingConflict` (calculado à parte, contra o período pedido).
 */
const BLOCKING_OPERATIONAL_STATUSES: RoomOperationalStatus[] = ['maintenance', 'blocked']

export type AvailabilityInput = {
  roomStatus: AccommodationStatus
  categoryStatus: AccommodationStatus | null
  operationalStatus: RoomOperationalStatus
  capacityMax: number
  petsAllowed: boolean
  requestedAdults: number
  requestedChildren: number
  requestedPets: boolean
  hasBlockConflict: boolean
  hasBookingConflict: boolean
}

/** Retorna os motivos de indisponibilidade — lista vazia = disponível. */
export function evaluateRoomAvailability(input: AvailabilityInput): AvailabilityReason[] {
  const reasons: AvailabilityReason[] = []

  if (input.roomStatus !== 'active') reasons.push('inactive_room')
  if (input.categoryStatus && input.categoryStatus !== 'active') reasons.push('inactive_category')

  const requestedGuests = input.requestedAdults + input.requestedChildren
  if (requestedGuests > input.capacityMax) reasons.push('insufficient_capacity')
  if (input.requestedPets && !input.petsAllowed) reasons.push('pets_not_allowed')

  if (BLOCKING_OPERATIONAL_STATUSES.includes(input.operationalStatus)) {
    reasons.push('operational_status_blocking')
  }
  if (input.hasBlockConflict) reasons.push('blocked_period')
  if (input.hasBookingConflict) reasons.push('booking_conflict')

  return reasons
}

/**
 * Sobreposição de intervalo semiaberto `[início, fim)` — um checkout no
 * mesmo instante do próximo checkin NUNCA é conflito.
 */
export function rangesOverlap(
  aStart: string | Date,
  aEnd: string | Date,
  bStart: string | Date,
  bEnd: string | Date,
): boolean {
  const as = new Date(aStart).getTime()
  const ae = new Date(aEnd).getTime()
  const bs = new Date(bStart).getTime()
  const be = new Date(bEnd).getTime()
  return as < be && ae > bs
}

export function validateDateRange(checkin: string, checkout: string): boolean {
  return new Date(checkin).getTime() < new Date(checkout).getTime()
}
