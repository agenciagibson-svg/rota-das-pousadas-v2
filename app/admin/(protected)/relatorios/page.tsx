import type { Metadata } from 'next'
import { BarChart3 } from 'lucide-react'
import { AdminShell } from '@/features/admin/components/admin-shell'
import { EmptyState } from '@/components/ui/empty-state'
import { getCurrentUser } from '@/server/queries'

export const metadata: Metadata = {
  title: 'Relatórios — Admin',
  robots: { index: false, follow: false },
}

export default async function AdminRelatoriosPage() {
  const user = await getCurrentUser()

  return (
    <AdminShell
      active="relatorios"
      title="Relatórios"
      subtitle="Exportações e análises detalhadas"
      displayName={user?.name || user?.email || 'Equipe'}
    >
      <EmptyState
        icon={BarChart3}
        title="Em breve"
        description="Relatórios exportáveis (financeiro, ocupação, aquisição) ainda não foram construídos."
      />
    </AdminShell>
  )
}
