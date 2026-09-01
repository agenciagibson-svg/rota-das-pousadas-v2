import { getCurrentUser, getOwnerPousada, getTeamMembers, canInviteMembers } from '@/server/queries'
import { TeamView } from '@/features/membros'

export default async function DashboardMembrosPage() {
  const [user, pousada, members, canInvite] = await Promise.all([
    getCurrentUser(),
    getOwnerPousada(),
    getTeamMembers(),
    canInviteMembers(),
  ])
  const displayName = user?.name || user?.email || 'Proprietário'

  return (
    <TeamView
      displayName={displayName}
      pousadaName={pousada?.name ?? 'Sua pousada'}
      currentUserId={user?.id ?? ''}
      members={members}
      canInvite={canInvite}
    />
  )
}
