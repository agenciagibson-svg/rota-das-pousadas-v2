import type { Metadata } from 'next'
import { BarChart3 } from 'lucide-react'
import { DashboardShell } from '@/components/dashboard/shell'
import { adminNav } from '@/features/admin/admin-nav'
import { EmptyState } from '@/components/ui/empty-state'
import { getCurrentUser } from '@/server/queries'

export const metadata: Metadata = {
  title: 'Relatórios — Admin',
  robots: { index: false, follow: false },
}

export default async function AdminRelatoriosPage() {
  const user = await getCurrentUser()

  return (
    <DashboardShell
      nav={adminNav('relatorios')}
      brandLabel="Rota Admin"
      brandSub="Painel Master"
      title="Relatórios"
      subtitle="Exportações e análises detalhadas"
      accent="ocean"
      user={{ name: user?.name || user?.email || 'Equipe', role: 'Administrador' }}
    >
      <EmptyState
        icon={BarChart3}
        title="Em breve"
        description="Relatórios exportáveis (financeiro, ocupação, aquisição) ainda não foram construídos."
      />
    </DashboardShell>
  )
}
