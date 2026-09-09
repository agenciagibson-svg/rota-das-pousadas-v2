import { getCurrentUser, getOwnerPousada, getOwnerSettings } from '@/server/queries'
import { OwnerSettingsView } from '@/features/gestao/components/owner-settings-view'
import { getOwnerPaymentAccountStatus } from '@/features/pagamentos/services/oauth.service'

export default async function DashboardConfiguracoesPage() {
  const [user, pousada, settings, paymentAccount] = await Promise.all([
    getCurrentUser(),
    getOwnerPousada(),
    getOwnerSettings(),
    getOwnerPaymentAccountStatus(),
  ])
  const displayName = user?.name || user?.email || 'Proprietário'

  return (
    <OwnerSettingsView
      displayName={displayName}
      pousadaName={pousada?.name ?? 'Sua pousada'}
      settings={settings}
      paymentAccount={paymentAccount}
    />
  )
}
