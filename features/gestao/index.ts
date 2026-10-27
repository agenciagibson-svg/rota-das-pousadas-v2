/**
 * Gestão (PMS) — superfície pública (client-safe).
 * Services (server-only) via `@/server/queries`.
 */
export { OwnerReservationsView } from './components/owner-reservations-view'
export { OwnerReservationsTable } from './components/owner-reservations-table'
export { ReservationsCalendar } from './components/reservations-calendar'
export { OwnerOccupancyView } from './components/owner-occupancy-view'
export { parseNewBookingPrefill, type OccupancyBoard } from './occupancy'
export { buildMonthGrid, expandOccupied, type CalendarDay, type DayStatus, type DateRange } from './calendar'
export type { OwnerReservation, ManagedPousada } from './types'
