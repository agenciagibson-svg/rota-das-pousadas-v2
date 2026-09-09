import type { Metadata } from 'next'
import { Globe } from 'lucide-react'
import { DashboardShell } from '@/components/dashboard/shell'
import { adminNav } from '@/features/admin/admin-nav'
import { EmptyState } from '@/components/ui/empty-state'
import { getCurrentUser } from '@/server/queries'

export const metadata: Metadata = {
  title: 'Destinos — Admin',
  robots: { index: false, follow: false },
}

export default async function AdminDestinosPage() {
  const user = await getCurrentUser()

  return (
    <DashboardShell
      nav={adminNav('destinos')}
      brandLabel="Rota Admin"
      brandSub="Painel Master"
      title="Destinos"
      subtitle="Curadoria de destinos da plataforma"
      accent="ocean"
      user={{ name: user?.name || user?.email || 'Equipe', role: 'Administrador' }}
    >
      <EmptyState
        icon={Globe}
        title="Em breve"
        description="Gestão de destinos (criar, editar, destacar) ainda não foi construída."
      />
    </DashboardShell>
  )
}
