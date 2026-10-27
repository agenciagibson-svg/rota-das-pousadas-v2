import { sectionDenied } from '@/lib/auth/section-guard'
import { NoSectionAccess } from '@/components/dashboard/no-section-access'
import {
  getCurrentUser,
  getFinance,
  getOwnerCoupons,
  getOwnerPousada,
  getOwnerReservations,
  getOwnerReviews,
  getOwnerSettings,
} from '@/server/queries'
import { OwnerMarketingView } from '@/features/gestao/components/owner-marketing-view'
import { CouponsPanel } from '@/features/cupons/components/coupons-panel'
import { DEFAULT_TIMEZONE, isoDateInTimeZone } from '@/lib/dates'

export default async function DashboardMarketingPage() {
  if (await sectionDenied('marketing'))
    return <NoSectionAccess section="marketing" title="Marketing" />

  const [user, pousada, settings, reservations, reviews, finance, coupons] = await Promise.all([
    getCurrentUser(),
    getOwnerPousada(),
    getOwnerSettings(),
    getOwnerReservations(),
    getOwnerReviews(),
    getFinance(),
    // Cupons não podem derrubar a página de marketing.
    getOwnerCoupons().catch((error) => {
      console.error('[marketing] falha ao carregar cupons', error)
      return null
    }),
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
    >
      {coupons && (
        <CouponsPanel
          coupons={coupons}
          todayISO={isoDateInTimeZone(new Date(), pousada?.timezone ?? DEFAULT_TIMEZONE)}
        />
      )}
    </OwnerMarketingView>
  )
}
