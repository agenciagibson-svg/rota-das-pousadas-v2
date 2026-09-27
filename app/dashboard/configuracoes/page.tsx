import { sectionDenied } from '@/lib/auth/section-guard'
import { NoSectionAccess } from '@/components/dashboard/no-section-access'
import { getCurrentUser, getOwnerPousada, getOwnerSettings } from '@/server/queries'
import { OwnerSettingsView } from '@/features/gestao/components/owner-settings-view'
import { getOwnerPaymentAccountStatus } from '@/features/pagamentos/services/oauth.service'
import { getOwnerSubscriptionStatus } from '@/features/pagamentos/services/subscription.service'
import { getOwnerPixSettings } from '@/features/pagamentos/services/pix.service'
import { getOwnerGuestSettings } from '@/features/pedidos/services/orders.service'

export default async function DashboardConfiguracoesPage() {
  if (await sectionDenied('configuracoes'))
    return <NoSectionAccess section="configuracoes" title="Configurações" />

  const [user, pousada, settings, paymentAccount, subscription, pix, guestSettings] =
    await Promise.all([
      getCurrentUser(),
      getOwnerPousada(),
      getOwnerSettings(),
      getOwnerPaymentAccountStatus(),
      getOwnerSubscriptionStatus(),
      getOwnerPixSettings(),
      getOwnerGuestSettings().catch(() => null),
    ])
  const displayName = user?.name || user?.email || 'Proprietário'

  return (
    <OwnerSettingsView
      displayName={displayName}
      pousadaName={pousada?.name ?? 'Sua pousada'}
      settings={settings}
      paymentAccount={paymentAccount}
      subscription={subscription}
      pix={pix}
      guestSettings={guestSettings}
    />
  )
}
