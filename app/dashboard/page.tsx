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
import { GrowthInvite } from '@/components/dashboard/growth-invite'
import { getOwnerGrowthCard } from '@/features/admin/services/growth.service'
import { PaymentAlerts } from '@/components/dashboard/payment-alerts'
import { getPaymentAlerts } from '@/features/pagamentos/services/pix.service'
import { getOperationalAlerts } from '@/features/pedidos/services/orders.service'
import { getSetupProgress } from '@/features/onboarding/services/setup.service'
import { SetupChecklist } from '@/components/dashboard/setup-checklist'
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
        today={null}
        upcomingReservations={[]}
      />
    )
  }

  const role = await getActiveTenantRole()
  const showRevenue = Boolean(role && can(role, 'finance:pousada:view'))
  const [reservations, rooms, reviews, growth, paymentAlerts, operational, setup] =
    await Promise.all([
      getOwnerReservations(),
      // Papéis sem `room:status:view` (financeiro, por exemplo) não leem
      // acomodações. Nesse caso a ocupação fica indisponível e o painel diz isso
      // — nunca estima um número que não corresponde à casa do cliente.
      getOwnerRooms().catch(() => null),
      getOwnerReviews().catch(() => []),
      // Convite de tráfego pago: só proprietário/admin; falha nunca derruba o painel.
      getOwnerGrowthCard().catch(() => null),
      // Comprovantes Pix e pagamentos para revisar (0082); falha nunca derruba o painel.
      getPaymentAlerts().catch((error) => {
        console.error('[dashboard] alertas de pagamento', String(error))
        return null
      }),
      // Pedidos novos do app da estadia (só papéis com `order:manage`).
      getOperationalAlerts().catch(() => null),
      // Configuração guiada: só proprietário/gestor; `null` para os outros papéis.
      getSetupProgress().catch(() => null),
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
  const todaySummary = {
    iso: todayISO,
    dateLabel: new Intl.DateTimeFormat('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: pousada.timezone,
    }).format(new Date()),
    arrivals,
    departures,
    inHouse: reservations.filter((r) => r.status === 'checked_in').length,
    roomsToClean: rooms
      ? rooms.filter((r) =>
          ['awaiting_cleaning', 'cleaning', 'inspection_pending'].includes(r.operationalStatus),
        ).length
      : null,
    newOrders: operational && operational.newOrders >= 0 ? operational.newOrders : null,
  }

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
      today={todaySummary}
      todayISO={todayISO}
      setupSlot={setup ? <SetupChecklist progress={setup} /> : null}
      upcomingReservations={upcomingReservations(reservations, todayISO)}
      growthSlot={growth && pousada.status === 'publicada' ? <GrowthInvite card={growth} /> : null}
      alertsSlot={
        paymentAlerts ? (
          <PaymentAlerts
            reviews={paymentAlerts.reviews}
            openProofs={paymentAlerts.openProofs}
            canResolve={paymentAlerts.canResolve}
          />
        ) : null
      }
    />
  )
}
