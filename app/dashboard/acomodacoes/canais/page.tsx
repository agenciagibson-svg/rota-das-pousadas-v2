import {
  canManageChannels,
  getCurrentUser,
  getOwnerChannels,
  getOwnerPousada,
  getOwnerRooms,
} from '@/server/queries'
import { ChannelsView } from '@/features/canais/components/channels-view'

export default async function DashboardCanaisPage() {
  const [user, pousada, channels, rooms, canManage] = await Promise.all([
    getCurrentUser(),
    getOwnerPousada(),
    getOwnerChannels(),
    getOwnerRooms(),
    canManageChannels(),
  ])

  const displayName = user?.name || user?.email || 'Proprietário'

  return (
    <ChannelsView
      displayName={displayName}
      pousadaName={pousada?.name ?? 'Sua pousada'}
      channels={channels}
      rooms={rooms}
      canManage={canManage}
    />
  )
}
