import { DashboardShell } from '@/components/dashboard/shell'
import { ownerDashboardNav } from '@/components/dashboard/owner-nav'
import { Card } from '@/components/ui/card'
import { InviteMemberForm } from './invite-member-form'
import { TeamTable } from './team-table'
import type { TeamMember } from '../types'

export function TeamView({
  displayName,
  pousadaName,
  currentUserId,
  members,
  canInvite,
}: {
  displayName: string
  pousadaName: string
  currentUserId: string
  members: TeamMember[]
  canInvite: boolean
}) {
  return (
    <DashboardShell
      nav={ownerDashboardNav('membros')}
      brandLabel={pousadaName}
      brandSub="Painel do proprietário"
      title="Membros"
      subtitle="Quem tem acesso à gestão desta pousada."
      user={{ name: displayName, role: 'Proprietário' }}
    >
      <div className="space-y-6">
        {canInvite && (
          <Card className="p-5">
            <h2 className="font-semibold text-foreground">Convidar</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              A pessoa precisa já ter uma conta na plataforma. O envio automático de e-mail ainda
              não está integrado — avise a pessoa diretamente após convidar.
            </p>
            <div className="mt-4">
              <InviteMemberForm />
            </div>
          </Card>
        )}

        <Card className="p-5">
          <h2 className="font-semibold text-foreground">Equipe</h2>
          <div className="mt-4">
            <TeamTable members={members} currentUserId={currentUserId} />
          </div>
        </Card>
      </div>
    </DashboardShell>
  )
}
