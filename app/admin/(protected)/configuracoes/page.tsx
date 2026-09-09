import type { Metadata } from 'next'
import { Settings } from 'lucide-react'
import { AdminShell } from '@/features/admin/components/admin-shell'
import { EmptyState } from '@/components/ui/empty-state'
import { getCurrentUser } from '@/server/queries'

export const metadata: Metadata = {
  title: 'Configurações — Admin',
  robots: { index: false, follow: false },
}

export default async function AdminConfiguracoesPage() {
  const user = await getCurrentUser()

  return (
    <AdminShell
      active="configuracoes"
      title="Configurações"
      subtitle="Parâmetros globais da plataforma"
      displayName={user?.name || user?.email || 'Equipe'}
    >
      <EmptyState
        icon={Settings}
        title="Em breve"
        description="Configurações de plataforma (comissão padrão, integrações, papéis) ainda não foram construídas."
      />
    </AdminShell>
  )
}
