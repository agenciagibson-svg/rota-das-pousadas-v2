import { getActiveTenantRole } from '@/lib/auth/tenant-context'
import { can } from '@/lib/auth/rbac'
import {
  getCurrentUser,
  getOwnerPousada,
  getOwnerReservations,
  getOwnerReviews,
  getOwnerRooms,
} from '@/server/queries'
import { OwnerDashboardView } from '@/components/dashboard/owner-dashboard-view'
import {
  addDays,
  calculateOccupancy,
  dayMovements,
  monthlyRevenue,
  pousadaToday,
  summarizeReviews,
  upcomingReservations,
  weeklyDailies,
} from '@/features/dashboard/metrics'

export default async function DashboardPage() {
  const [currentUser, pousada] = await Promise.all([getCurrentUser(), getOwnerPousada()])
  const displayName = currentUser?.name || currentUser?.email || 'Proprietário'

  // Sem pousada gerida a view cai no onboarding — nada a medir.
  if (!pousada) {
    return (
      <OwnerDashboardView
        displayName={displayName}
        pousadaName={null}
        pousadaStatus={null}
        reservations={[]}
        occupancy={null}
        revenueSeries={[]}
        week={{ labels: [], data: [], total: 0 }}
        reviews={{ total: 0, average: 0, distribution: [] }}
        arrivalsToday={[]}
        departuresToday={[]}
        upcomingReservations={[]}
      />
    )
  }

  const role = await getActiveTenantRole()
  const showRevenue = Boolean(role && can(role, 'finance:pousada:view'))
  const [reservations, rooms, reviews] = await Promise.all([
    getOwnerReservations(),
    // Papéis sem `room:status:view` (financeiro, por exemplo) não leem
    // acomodações. Nesse caso a ocupação fica indisponível e o painel diz isso
    // — nunca estima um número que não corresponde à casa do cliente.
    getOwnerRooms().catch(() => null),
    getOwnerReviews().catch(() => []),
  ])

  // "Hoje" no fuso da pousada: em UTC o painel já virava o dia às 21h.
  const today = pousadaToday(new Date(), pousada.timezone)
  const todayISO = today.iso

  const sellableRooms = rooms
    ? rooms.filter(
        (room) =>
          room.status === 'active' &&
          room.operationalStatus !== 'maintenance' &&
          room.operationalStatus !== 'blocked',
      ).length
    : null

  const occupancy =
    sellableRooms === null
      ? null
      : calculateOccupancy(reservations, sellableRooms, todayISO, addDays(todayISO, 7), today.date)

  const { arrivals, departures } = dayMovements(reservations, todayISO)

  return (
    <OwnerDashboardView
      displayName={displayName}
      pousadaName={pousada.name}
      pousadaStatus={pousada.status}
      reservations={reservations}
      occupancy={occupancy}
      revenueSeries={showRevenue ? monthlyRevenue(reservations, today.date) : []}
      showRevenue={showRevenue}
      week={weeklyDailies(reservations, today.date)}
      reviews={summarizeReviews(reviews)}
      arrivalsToday={arrivals}
      departuresToday={departures}
      upcomingReservations={upcomingReservations(reservations, todayISO)}
    />
  )
}
