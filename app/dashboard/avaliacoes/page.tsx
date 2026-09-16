import { getCurrentUser, getOwnerPousada, getOwnerReviews, canRespondReviews } from '@/server/queries'
import { OwnerReviewsView } from '@/features/gestao/components/owner-reviews-view'

export default async function DashboardAvaliacoesPage() {
  const [user, pousada, reviews, canRespond] = await Promise.all([
    getCurrentUser(),
    getOwnerPousada(),
    getOwnerReviews(),
    canRespondReviews(),
  ])
  const displayName = user?.name || user?.email || 'Proprietário'

  return (
    <OwnerReviewsView
      displayName={displayName}
      pousadaName={pousada?.name ?? 'Sua pousada'}
      reviews={reviews}
      canRespond={canRespond}
    />
  )
}
