import {
  getCurrentUser,
  getOwnerPousada,
  getOwnerReservations,
  getOwnerSettings,
} from '@/server/queries'
import { OwnerMessagesView } from '@/features/gestao/components/owner-messages-view'

export default async function DashboardMensagensPage() {
  const [user, pousada, reservations, settings] = await Promise.all([
    getCurrentUser(),
    getOwnerPousada(),
    getOwnerReservations(),
    getOwnerSettings(),
  ])
  const displayName = user?.name || user?.email || 'Proprietário'

  return (
    <OwnerMessagesView
      displayName={displayName}
      pousadaName={pousada?.name ?? 'Sua pousada'}
      reservations={reservations}
      settings={settings}
    />
  )
}
