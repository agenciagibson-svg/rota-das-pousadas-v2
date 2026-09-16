import type { Metadata } from 'next'
import { AdminShell } from '@/features/admin/components/admin-shell'
import { Card } from '@/components/ui/card'
import { PousadasTable } from '@/features/admin/components/pousadas-table'
import { listPousadasAdmin, canManageGrants } from '@/features/admin/services/admin.service'
import { getCurrentUser } from '@/server/queries'
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
  const [user, pousadas, grantsAllowed] = await Promise.all([
    getCurrentUser(),
    listPousadasAdmin(filter),
    canManageGrants(),
  ])

  return (
    <AdminShell
      active="pousadas"
      title="Pousadas"
      subtitle="Todas as pousadas da plataforma, qualquer status"
      displayName={user?.name || user?.email || 'Equipe'}
    >
      <Card className="p-6">
        <PousadasTable items={pousadas} canManageGrants={grantsAllowed} />
      </Card>
    </AdminShell>
  )
}
