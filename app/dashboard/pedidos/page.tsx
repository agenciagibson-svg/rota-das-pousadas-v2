import { sectionDenied } from '@/lib/auth/section-guard'
import { NoSectionAccess } from '@/components/dashboard/no-section-access'
import { getCurrentUser, getOwnerPousada } from '@/server/queries'
import { getOrdersScreen } from '@/features/pedidos/services/orders.service'
import { OrdersBoard } from '@/features/pedidos/components/orders-board'

export const dynamic = 'force-dynamic'

export default async function DashboardPedidosPage() {
  if (await sectionDenied('pedidos')) return <NoSectionAccess section="pedidos" title="Pedidos" />

  const [user, pousada] = await Promise.all([getCurrentUser(), getOwnerPousada()])
  const screen = await getOrdersScreen(pousada?.timezone || 'America/Sao_Paulo')

  return (
    <OrdersBoard
      displayName={user?.name || user?.email || 'Proprietário'}
      pousadaName={pousada?.name ?? 'Sua pousada'}
      {...screen}
    />
  )
}
