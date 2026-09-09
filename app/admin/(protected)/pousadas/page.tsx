import type { Metadata } from 'next'
import { DashboardShell } from '@/components/dashboard/shell'
import { adminNav } from '@/features/admin/admin-nav'
import { Card } from '@/components/ui/card'
import { PousadasTable } from '@/features/admin/components/pousadas-table'
import { listPousadasAdmin } from '@/features/admin/services/admin.service'
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
  const [user, pousadas] = await Promise.all([getCurrentUser(), listPousadasAdmin(filter)])

  return (
    <DashboardShell
      nav={adminNav('pousadas')}
      brandLabel="Rota Admin"
      brandSub="Painel Master"
      title="Pousadas"
      subtitle="Todas as pousadas da plataforma, qualquer status"
      accent="ocean"
      user={{ name: user?.name || user?.email || 'Equipe', role: 'Administrador' }}
    >
      <Card className="p-6">
        <PousadasTable items={pousadas} />
      </Card>
    </DashboardShell>
  )
}
