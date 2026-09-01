import {
  getCurrentUser,
  getFinance,
  getOwnerPousada,
  getOwnerReservations,
  getOwnerReviews,
  getOwnerSettings,
} from '@/server/queries'
import { OwnerMarketingView } from '@/features/gestao/components/owner-marketing-view'

export default async function DashboardMarketingPage() {
  const [user, pousada, settings, reservations, reviews, finance] = await Promise.all([
    getCurrentUser(),
    getOwnerPousada(),
    getOwnerSettings(),
    getOwnerReservations(),
    getOwnerReviews(),
    getFinance(),
  ])
  const displayName = user?.name || user?.email || 'Proprietário'

  return (
    <OwnerMarketingView
      displayName={displayName}
      pousadaName={pousada?.name ?? 'Sua pousada'}
      settings={settings}
      reservations={reservations}
      reviews={reviews}
      finance={finance.summary}
    />
  )
}
