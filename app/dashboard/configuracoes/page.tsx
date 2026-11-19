import { sectionDenied } from '@/lib/auth/section-guard'
import { NoSectionAccess } from '@/components/dashboard/no-section-access'
import {
  getCurrentUser,
  getOwnerContractState,
  getOwnerPousada,
  getOwnerSettings,
} from '@/server/queries'
import { OwnerSettingsView } from '@/features/gestao/components/owner-settings-view'
import { getOwnerPaymentAccountStatus } from '@/features/pagamentos/services/oauth.service'
import { getOwnerSubscriptionStatus } from '@/features/pagamentos/services/subscription.service'
import { getOwnerPixSettings } from '@/features/pagamentos/services/pix.service'
import { getOwnerGuestSettings } from '@/features/pedidos/services/orders.service'

export default async function DashboardConfiguracoesPage() {
  if (await sectionDenied('configuracoes'))
    return <NoSectionAccess section="configuracoes" title="Configurações" />

  const [user, pousada, settings, paymentAccount, subscription, pix, guestSettings, contract] =
    await Promise.all([
      getCurrentUser(),
      getOwnerPousada(),
      getOwnerSettings(),
      getOwnerPaymentAccountStatus(),
      getOwnerSubscriptionStatus(),
      getOwnerPixSettings(),
      getOwnerGuestSettings().catch(() => null),
      // O contrato não pode derrubar as Configurações: sem leitura, o cartão some.
      getOwnerContractState().catch((error: unknown) => {
        console.error('[configuracoes] falha ao ler a situação do contrato', error)
        return null
      }),
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
      contract={contract?.active ? { accepted: contract.acceptedCurrent } : null}
    />
  )
}
