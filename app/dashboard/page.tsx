import { getCurrentUser, getOwnerPousada, getOwnerReservations } from '@/server/queries'
import { OwnerDashboardView } from '@/components/dashboard/owner-dashboard-view'

export default async function DashboardPage() {
  const [currentUser, pousada] = await Promise.all([getCurrentUser(), getOwnerPousada()])
  const displayName = currentUser?.name || currentUser?.email || 'Proprietário'

  // Só busca reservas se houver pousada gerida.
  const reservations = pousada ? await getOwnerReservations() : []

  return (
    <OwnerDashboardView
      displayName={displayName}
      pousadaName={pousada?.name ?? null}
      pousadaStatus={pousada?.status ?? null}
      reservations={reservations}
    />
  )
}
