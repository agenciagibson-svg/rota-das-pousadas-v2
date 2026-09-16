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
 * Transições permitidas (RB seção 6). Pura e testável — espelha exatamente a
 * tabela reimplementada no banco (set_booking_status: 0034 para as
 * pré-check-in, 0048 para o ciclo da estadia). A regra de DATA do check-in
 * (só a partir da entrada, no fuso da pousada) vive só na RPC — aqui é
 * apenas a máquina de estados.
 */
const ALLOWED_TRANSITIONS: ReadonlyArray<readonly [BookingStatus, BookingStatus]> = [
  ['quote', 'pending'],
  ['quote', 'confirmed'],
  ['quote', 'cancelled'],
  ['pending', 'confirmed'],
  ['pending', 'cancelled'],
  ['confirmed', 'cancelled'],
  ['confirmed', 'no_show'],
  // 0048 — ciclo da estadia
  ['confirmed', 'checked_in'],
  ['checked_in', 'checked_out'],
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
