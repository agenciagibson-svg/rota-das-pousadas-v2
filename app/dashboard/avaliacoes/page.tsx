import { sectionDenied } from '@/lib/auth/section-guard'
import { NoSectionAccess } from '@/components/dashboard/no-section-access'
import {
  getCurrentUser,
  getOwnerPousada,
  getOwnerReviews,
  canRespondReviews,
} from '@/server/queries'
import { OwnerReviewsView } from '@/features/gestao/components/owner-reviews-view'

export default async function DashboardAvaliacoesPage() {
  if (await sectionDenied('avaliacoes'))
    return <NoSectionAccess section="avaliacoes" title="Avaliações" />

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
