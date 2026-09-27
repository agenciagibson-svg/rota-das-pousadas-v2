import { sectionDenied } from '@/lib/auth/section-guard'
import { NoSectionAccess } from '@/components/dashboard/no-section-access'
import {
  getCurrentUser,
  getFinance,
  getOwnerPousada,
  getOwnerReservations,
  getOwnerReviews,
  getOwnerSettings,
} from '@/server/queries'
import { OwnerAssistantView } from '@/features/gestao/components/owner-assistant-view'
import { getOperationalAlerts } from '@/features/pedidos/services/orders.service'

export default async function DashboardAssistentePage() {
  if (await sectionDenied('assistente'))
    return <NoSectionAccess section="assistente" title="Assistente" />

  const [user, pousada, reservations, reviews, finance, settings, alerts] = await Promise.all([
    getCurrentUser(),
    getOwnerPousada(),
    getOwnerReservations(),
    getOwnerReviews(),
    getFinance(),
    getOwnerSettings(),
    getOperationalAlerts().catch(() => null),
  ])
  const displayName = user?.name || user?.email || 'Proprietário'

  return (
    <OwnerAssistantView
      displayName={displayName}
      pousadaName={pousada?.name ?? 'Sua pousada'}
      reservations={reservations}
      reviews={reviews}
      finance={finance.summary}
      settings={settings}
      alerts={alerts}
    />
  )
}
