import { sectionDenied } from '@/lib/auth/section-guard'
import { NoSectionAccess } from '@/components/dashboard/no-section-access'
import {
  getCurrentUser,
  getFinance,
  getOwnerCoupons,
  getOwnerOffers,
  getOwnerPousada,
  getOwnerReservations,
  getOwnerReviews,
  getOwnerSettings,
} from '@/server/queries'
import { OwnerMarketingView } from '@/features/gestao/components/owner-marketing-view'
import { CouponsPanel } from '@/features/cupons/components/coupons-panel'
import { OffersPanel } from '@/features/ofertas/components/offers-panel'
import { AutoOffersForm } from '@/features/ofertas/components/auto-offers-form'
import { DEFAULT_TIMEZONE, isoDateInTimeZone } from '@/lib/dates'

export default async function DashboardMarketingPage() {
  if (await sectionDenied('marketing'))
    return <NoSectionAccess section="marketing" title="Marketing" />

  const [user, pousada, settings, reservations, reviews, finance, coupons, offers] =
    await Promise.all([
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
      // Ofertas para ex-hóspedes (0111): só dono e gestor; falha não derruba a página.
      getOwnerOffers().catch(() => null),
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
      <div className="space-y-5">
        {coupons && (
          <CouponsPanel
            coupons={coupons}
            todayISO={isoDateInTimeZone(new Date(), pousada?.timezone ?? DEFAULT_TIMEZONE)}
          />
        )}
        {offers && (
          <OffersPanel audience={offers.audience} report={offers.report}>
            {offers.auto && <AutoOffersForm initial={offers.auto} />}
          </OffersPanel>
        )}
      </div>
    </OwnerMarketingView>
  )
}
