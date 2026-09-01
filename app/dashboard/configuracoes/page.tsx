import { getCurrentUser, getOwnerPousada, getOwnerSettings } from '@/server/queries'
import { OwnerSettingsView } from '@/features/gestao/components/owner-settings-view'

export default async function DashboardConfiguracoesPage() {
  const [user, pousada, settings] = await Promise.all([
    getCurrentUser(),
    getOwnerPousada(),
    getOwnerSettings(),
  ])
  const displayName = user?.name || user?.email || 'Proprietário'

  return (
    <OwnerSettingsView
      displayName={displayName}
      pousadaName={pousada?.name ?? 'Sua pousada'}
      settings={settings}
    />
  )
}
