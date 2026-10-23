/**
 * Reservas feature — superfície pública (client-safe).
 * Services (server-only) devem ser acessados via `@/server/queries`.
 */
export { BookingForm } from './components/booking-form'
export { CancelBookingButton } from './components/cancel-booking-button'
export { StaleDatesNotice } from './components/stale-dates-notice'
export {
  averageNightly,
  calculateBookingPrice,
  nightsBetween,
  quoteMatches,
  SERVICE_FEE_RATE,
} from './pricing'
export type { StayQuote } from './pricing'
export { BOOKING_STATUS } from './status'
export { bioOriginFromParam, createBookingSchema, type CreateBookingInput } from './schemas'
export type { Booking, BookingStatus, PriceBreakdown } from './types'
