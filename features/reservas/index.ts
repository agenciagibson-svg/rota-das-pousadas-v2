/**
 * Reservas feature — superfície pública (client-safe).
 * Services (server-only) devem ser acessados via `@/server/queries`.
 */
export { BookingForm } from './components/booking-form'
export { CancelBookingButton } from './components/cancel-booking-button'
export { BookingTripActions } from './components/booking-trip-actions'
export { StaleDatesNotice } from './components/stale-dates-notice'
export { PriceCalendar } from './components/price-calendar'
export { PriceCalendarGrid } from './components/price-calendar-grid'
export {
  buildCalendarMonth,
  canGoToMonth,
  clampMonth,
  indexCalendarDays,
  isMonth,
  monthOf,
  nextSelection,
  selectionHint,
  shiftMonth,
} from './price-calendar'
export type { CalendarSelection, PriceCalendarDay } from './price-calendar'
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
