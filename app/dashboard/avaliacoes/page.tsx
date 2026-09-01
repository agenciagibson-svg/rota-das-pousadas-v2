import { getCurrentUser, getOwnerPousada, getOwnerReviews } from '@/server/queries'
import { OwnerReviewsView } from '@/features/gestao/components/owner-reviews-view'

export default async function DashboardAvaliacoesPage() {
  const [user, pousada, reviews] = await Promise.all([
    getCurrentUser(),
    getOwnerPousada(),
    getOwnerReviews(),
  ])
  const displayName = user?.name || user?.email || 'Proprietário'

  return (
    <OwnerReviewsView
      displayName={displayName}
      pousadaName={pousada?.name ?? 'Sua pousada'}
      reviews={reviews}
    />
  )
}
