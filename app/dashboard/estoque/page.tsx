import { sectionDenied } from '@/lib/auth/section-guard'
import { NoSectionAccess } from '@/components/dashboard/no-section-access'
import { getCurrentUser, getOwnerPousada } from '@/server/queries'
import { getInventoryScreen } from '@/features/estoque/services/inventory.service'
import { InventoryView } from '@/features/estoque/components/inventory-view'

export default async function DashboardEstoquePage() {
  if (await sectionDenied('estoque')) return <NoSectionAccess section="estoque" title="Estoque" />

  const [user, pousada, screen] = await Promise.all([
    getCurrentUser(),
    getOwnerPousada(),
    getInventoryScreen(),
  ])

  return (
    <InventoryView
      displayName={user?.name || user?.email || 'Proprietário'}
      pousadaName={pousada?.name ?? 'Sua pousada'}
      pousadaId={screen.pousadaId}
      items={screen.items}
      movements={screen.movements}
      permissions={screen.permissions}
    />
  )
}
