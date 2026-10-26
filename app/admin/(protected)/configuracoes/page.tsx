import type { Metadata } from 'next'
import { ShieldOff } from 'lucide-react'
import { AdminShell } from '@/features/admin/components/admin-shell'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { PlatformTeam } from '@/features/admin/components/platform-team'
import { SentryTest } from '@/features/admin/components/sentry-test'
import { EmailTest } from '@/features/admin/components/email-test'
import { MonthlyReportPreview } from '@/features/admin/components/monthly-report-preview'
import { GuestProfileBackfill } from '@/features/admin/components/guest-profile-backfill'
import {
  listPlatformTeamAdmin,
  listPousadasAdmin,
  canManageRoles,
} from '@/features/admin/services/admin.service'
import { getCurrentUser } from '@/server/queries'

export const metadata: Metadata = {
  title: 'Configurações — Admin',
  robots: { index: false, follow: false },
}

export default async function AdminConfiguracoesPage() {
  const [user, canManage] = await Promise.all([getCurrentUser(), canManageRoles()])
  const [team, pousadas] = canManage
    ? await Promise.all([
        listPlatformTeamAdmin(),
        listPousadasAdmin().catch((error: unknown) => {
          console.error('[admin] falha ao listar pousadas para a prévia do relatório', error)
          return []
        }),
      ])
    : [[], []]

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
      {canManage && (
        <Card className="mt-5 p-6">
          <MonthlyReportPreview
            pousadas={pousadas.map((p) => ({ id: p.id, name: p.name, status: p.status }))}
          />
        </Card>
      )}
      {canManage && (
        <Card className="mt-5 p-6">
          <GuestProfileBackfill />
        </Card>
      )}
    </AdminShell>
  )
}
