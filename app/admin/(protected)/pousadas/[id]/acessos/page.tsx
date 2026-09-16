import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { AdminShell } from '@/features/admin/components/admin-shell'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { ShieldOff } from 'lucide-react'
import { PousadaAccessGrants } from '@/features/admin/components/pousada-access-grants'
import { canManageGrants, getAccessGrantsPageData } from '@/features/admin/services/admin.service'
import { getCurrentUser } from '@/server/queries'

export const metadata: Metadata = {
  title: 'Acessos institucionais — Admin',
  robots: { index: false, follow: false },
}

export default async function AdminPousadaAcessosPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [user, allowed] = await Promise.all([getCurrentUser(), canManageGrants()])
  const displayName = user?.name || user?.email || 'Equipe'

  if (!allowed) {
    return (
      <AdminShell active="pousadas" title="Acessos institucionais" subtitle="Restrito" displayName={displayName}>
        <Card className="p-6">
          <EmptyState
            icon={ShieldOff}
            title="Sem permissão"
            description="Só a equipe master concede ou revoga acesso institucional a dados sensíveis de uma pousada."
          />
        </Card>
      </AdminShell>
    )
  }

  let data: Awaited<ReturnType<typeof getAccessGrantsPageData>>
  try {
    data = await getAccessGrantsPageData(id)
  } catch {
    notFound()
  }

  return (
    <AdminShell
      active="pousadas"
      title={`Acessos institucionais — ${data.pousadaName}`}
      subtitle="Conceda ou revogue acesso temporário e justificado a dados sensíveis desta pousada."
      displayName={displayName}
    >
      <Card className="p-6">
        <PousadaAccessGrants pousadaId={id} initialGrants={data.grants} />
      </Card>
    </AdminShell>
  )
}
