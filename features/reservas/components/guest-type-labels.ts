import type { BookingCompanion } from '../types'

/** Rótulo de exibição de `booking_guests.guest_type` — usado na ficha FNRH. */
export const GUEST_TYPE_LABEL: Record<BookingCompanion['guestType'], string> = {
  responsible: 'Responsável',
  adult: 'Adulto',
  child: 'Criança',
  infant: 'Bebê',
}
