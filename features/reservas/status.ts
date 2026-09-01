import type { BookingStatus } from './types'

type BadgeVariant = 'primarySoft' | 'goldSoft' | 'destructiveSoft' | 'secondary'

/** Rótulo e variante de Badge para cada status de reserva. */
export const BOOKING_STATUS: Record<BookingStatus, { label: string; variant: BadgeVariant }> = {
  quote: { label: 'Cotação', variant: 'secondary' },
  pending: { label: 'Aguardando pagamento', variant: 'goldSoft' },
  confirmed: { label: 'Confirmada', variant: 'primarySoft' },
  checked_in: { label: 'Em estadia', variant: 'primarySoft' },
  checked_out: { label: 'Concluída', variant: 'secondary' },
  cancelled: { label: 'Cancelada', variant: 'destructiveSoft' },
  no_show: { label: 'Não compareceu', variant: 'destructiveSoft' },
}

/**
 * Transições pré-check-in permitidas neste ciclo (RB seção 6). Pura e
 * testável — espelha exatamente a tabela reimplementada no banco
 * (set_booking_status, 0034_bookings_rpcs_and_rls.sql). Check-in/checkout
 * (Ciclo 6) não têm transição de origem alguma ainda.
 */
const ALLOWED_TRANSITIONS: ReadonlyArray<readonly [BookingStatus, BookingStatus]> = [
  ['quote', 'pending'],
  ['quote', 'confirmed'],
  ['quote', 'cancelled'],
  ['pending', 'confirmed'],
  ['pending', 'cancelled'],
  ['confirmed', 'cancelled'],
  ['confirmed', 'no_show'],
]

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return ALLOWED_TRANSITIONS.some(([f, t]) => f === from && t === to)
}

/** Status finais — reserva não pode mais ser editada livremente (RB seção 12/13). */
export function isFinalStatus(status: BookingStatus): boolean {
  return status === 'cancelled' || status === 'no_show' || status === 'checked_out'
}

/** Status que bloqueiam inventário (espelha o WHERE da EXCLUDE constraint, 0033). */
export function isOccupyingStatus(status: BookingStatus): boolean {
  return status === 'pending' || status === 'confirmed' || status === 'checked_in'
}
