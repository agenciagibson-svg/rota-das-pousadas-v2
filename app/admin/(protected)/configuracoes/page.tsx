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
import { ContractVersionsManager } from '@/features/contrato/components/contract-versions-manager'
import { listContractVersions } from '@/features/contrato/services/contract.service'
import { getCurrentUser } from '@/server/queries'
import { WelcomeGuideSettings } from '@/features/admin/components/welcome-guide-settings'
import { getWelcomeGuideAutoAdmin } from '@/features/admin/services/welcome-guide.service'

export const metadata: Metadata = {
  title: 'Configurações — Admin',
  robots: { index: false, follow: false },
}

export default async function AdminConfiguracoesPage() {
  const [user, canManage] = await Promise.all([getCurrentUser(), canManageRoles()])
  const [team, pousadas, contractVersions] = canManage
    ? await Promise.all([
        listPlatformTeamAdmin(),
        listPousadasAdmin().catch((error: unknown) => {
          console.error('[admin] falha ao listar pousadas para a prévia do relatório', error)
          return []
        }),
        // `null` = não deu para ler (ex.: migration 0103 ainda não aplicada): o bloco some.
        listContractVersions().catch((error: unknown) => {
          console.error('[admin] falha ao listar as versões do contrato', error)
          return null
        }),
      ])
    : [[], [], null]
  // 0107: `null` = migration ainda não aplicada (o bloco some).
  const welcomeGuideAuto = canManage
    ? await getWelcomeGuideAutoAdmin().catch((error: unknown) => {
        console.error('[admin] falha ao ler o envio automático do guia', error)
        return null
      })
    : null

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
      {canManage && welcomeGuideAuto !== null && (
        <Card className="mt-5 p-6">
          <WelcomeGuideSettings initialEnabled={welcomeGuideAuto} />
        </Card>
      )}
      {canManage && contractVersions && (
        <Card className="mt-5 p-6">
          <ContractVersionsManager versions={contractVersions} />
        </Card>
      )}
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
