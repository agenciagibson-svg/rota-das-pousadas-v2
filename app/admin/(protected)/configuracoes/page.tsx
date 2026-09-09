import type { Metadata } from 'next'
import { Settings } from 'lucide-react'
import { DashboardShell } from '@/components/dashboard/shell'
import { adminNav } from '@/features/admin/admin-nav'
import { EmptyState } from '@/components/ui/empty-state'
import { getCurrentUser } from '@/server/queries'

export const metadata: Metadata = {
  title: 'Configurações — Admin',
  robots: { index: false, follow: false },
}

export default async function AdminConfiguracoesPage() {
  const user = await getCurrentUser()

  return (
    <DashboardShell
      nav={adminNav('configuracoes')}
      brandLabel="Rota Admin"
      brandSub="Painel Master"
      title="Configurações"
      subtitle="Parâmetros globais da plataforma"
      accent="ocean"
      user={{ name: user?.name || user?.email || 'Equipe', role: 'Administrador' }}
    >
      <EmptyState
        icon={Settings}
        title="Em breve"
        description="Configurações de plataforma (comissão padrão, integrações, papéis) ainda não foram construídas."
      />
    </DashboardShell>
  )
}
