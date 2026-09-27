import { getCurrentUser, getOwnerPousada, getOwnerSettings } from '@/server/queries'
import { OwnerSettingsView } from '@/features/gestao/components/owner-settings-view'
import { getOwnerPaymentAccountStatus } from '@/features/pagamentos/services/oauth.service'
import { getOwnerSubscriptionStatus } from '@/features/pagamentos/services/subscription.service'
import { getOwnerPixSettings } from '@/features/pagamentos/services/pix.service'

export default async function DashboardConfiguracoesPage() {
  const [user, pousada, settings, paymentAccount, subscription, pix] = await Promise.all([
    getCurrentUser(),
    getOwnerPousada(),
    getOwnerSettings(),
    getOwnerPaymentAccountStatus(),
    getOwnerSubscriptionStatus(),
    getOwnerPixSettings(),
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
    />
  )
}
