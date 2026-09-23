import {
  getCurrentUser,
  getOwnerPousada,
  getOwnerReservations,
  getOwnerCalendar,
} from '@/server/queries'
import { OwnerReservationsView } from '@/features/gestao'
import { DEFAULT_TIMEZONE, isoDateInTimeZone } from '@/lib/dates'
import type { BookingStatus } from '@/features/reservas/types'

export default async function DashboardReservasPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string
    origin?: string
    guestName?: string
    checkinFrom?: string
    checkinTo?: string
  }>
}) {
  const params = await searchParams
  const filters = {
    status: (params.status || undefined) as BookingStatus | undefined,
    origin: params.origin || undefined,
    guestName: params.guestName || undefined,
    checkinFrom: params.checkinFrom || undefined,
    checkinTo: params.checkinTo || undefined,
  }

  const [user, pousada, reservations, calendar] = await Promise.all([
    getCurrentUser(),
    getOwnerPousada(),
    getOwnerReservations(filters),
    getOwnerCalendar(),
  ])

  const displayName = user?.name || user?.email || 'Proprietário'

  return (
    <OwnerReservationsView
      displayName={displayName}
      pousadaName={pousada?.name ?? 'Sua pousada'}
      reservations={reservations}
      occupied={calendar.occupied}
      blocked={calendar.blocked}
      filters={filters}
      todayISO={isoDateInTimeZone(new Date(), pousada?.timezone ?? DEFAULT_TIMEZONE)}
    />
  )
}
