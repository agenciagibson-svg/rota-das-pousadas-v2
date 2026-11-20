import type { Metadata } from 'next'
import { AdminShell } from '@/features/admin/components/admin-shell'
import { Card } from '@/components/ui/card'
import { PousadasTable } from '@/features/admin/components/pousadas-table'
import {
  listPousadasAdmin,
  canManageGrants,
  canLinkOwner,
} from '@/features/admin/services/admin.service'
import { getCurrentUser } from '@/server/queries'
import { canManageDemoLinks, listDemoLinks } from '@/features/demonstracao/services/demo.service'
import { listLastWelcomeGuideSends } from '@/features/admin/services/welcome-guide.service'
import type { Enums } from '@/lib/supabase/database.types'

export const metadata: Metadata = {
  title: 'Pousadas — Admin',
  robots: { index: false, follow: false },
}

const VALID_STATUSES: Enums<'pousada_status'>[] = [
  'rascunho',
  'em_analise',
  'aprovada',
  'publicada',
  'suspensa',
  'arquivada',
  'reprovada',
]

export default async function AdminPousadasPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams
  const filter = VALID_STATUSES.find((s) => s === status)
  const [user, pousadas, grantsAllowed, linkOwnerAllowed, demosAllowed, demoLinks] =
    await Promise.all([
      getCurrentUser(),
      listPousadasAdmin(filter),
      canManageGrants(),
      canLinkOwner(),
      canManageDemoLinks(),
      listDemoLinks(),
    ])
  // 0107: sem a migration (ou sem permissão), a tela segue sem o histórico.
  const guideSends = demosAllowed
    ? await listLastWelcomeGuideSends().catch((error: unknown) => {
        console.error('[admin] falha ao ler os envios do guia de links', error)
        return {}
      })
    : {}

  return (
    <AdminShell
      active="pousadas"
      title="Pousadas"
      subtitle="Todas as pousadas da plataforma, qualquer status"
      displayName={user?.name || user?.email || 'Equipe'}
    >
      <Card className="p-6">
        <PousadasTable
          items={pousadas}
          canManageGrants={grantsAllowed}
          canLinkOwner={linkOwnerAllowed}
          canManageDemos={demosAllowed}
          demoLinks={demoLinks}
          guideSends={guideSends}
        />
      </Card>
    </AdminShell>
  )
}
