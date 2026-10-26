import type { Metadata } from 'next'
import { ShieldOff } from 'lucide-react'
import { AdminShell } from '@/features/admin/components/admin-shell'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { PlatformTeam } from '@/features/admin/components/platform-team'
import { SentryTest } from '@/features/admin/components/sentry-test'
import { EmailTest } from '@/features/admin/components/email-test'
import { listPlatformTeamAdmin, canManageRoles } from '@/features/admin/services/admin.service'
import { getCurrentUser } from '@/server/queries'

export const metadata: Metadata = {
  title: 'Configurações — Admin',
  robots: { index: false, follow: false },
}

export default async function AdminConfiguracoesPage() {
  const [user, canManage] = await Promise.all([getCurrentUser(), canManageRoles()])
  const team = canManage ? await listPlatformTeamAdmin() : []

  return (
    <AdminShell
      active="configuracoes"
      title="Configurações"
      subtitle="Papéis de plataforma"
      displayName={user?.name || user?.email || 'Equipe'}
    >
      <Card className="p-6">
        {canManage ? (
          <PlatformTeam initialTeam={team} />
        ) : (
          <EmptyState
            icon={ShieldOff}
            title="Acesso restrito"
            description="Gestão de papéis de plataforma é exclusiva do master."
          />
        )}
      </Card>
      {canManage && (
        <Card className="mt-5 p-6">
          <SentryTest />
        </Card>
      )}
      {canManage && (
        <Card className="mt-5 p-6">
          <EmailTest />
        </Card>
      )}
    </AdminShell>
  )
}
