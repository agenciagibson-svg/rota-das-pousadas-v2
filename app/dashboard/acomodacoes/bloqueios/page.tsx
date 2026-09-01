import { getCurrentUser, getOwnerPousada, getOwnerBlocks, getOwnerRooms, canManageBlocks } from '@/server/queries'
import { BlocksView } from '@/features/acomodacoes'

export default async function DashboardBloqueiosPage() {
  const [user, pousada, blocks, rooms, canManage] = await Promise.all([
    getCurrentUser(),
    getOwnerPousada(),
    getOwnerBlocks(),
    getOwnerRooms(),
    canManageBlocks(),
  ])

  const displayName = user?.name || user?.email || 'Proprietário'

  return (
    <BlocksView
      displayName={displayName}
      pousadaName={pousada?.name ?? 'Sua pousada'}
      blocks={blocks}
      rooms={rooms}
      canManage={canManage}
    />
  )
}
