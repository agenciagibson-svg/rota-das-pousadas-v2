import type { Metadata } from 'next'
import { Globe } from 'lucide-react'
import { AdminShell } from '@/features/admin/components/admin-shell'
import { EmptyState } from '@/components/ui/empty-state'
import { getCurrentUser } from '@/server/queries'

export const metadata: Metadata = {
  title: 'Destinos — Admin',
  robots: { index: false, follow: false },
}

export default async function AdminDestinosPage() {
  const user = await getCurrentUser()

  return (
    <AdminShell
      active="destinos"
      title="Destinos"
      subtitle="Curadoria de destinos da plataforma"
      displayName={user?.name || user?.email || 'Equipe'}
    >
      <EmptyState
        icon={Globe}
        title="Em breve"
        description="Gestão de destinos (criar, editar, destacar) ainda não foi construída."
      />
    </AdminShell>
  )
}
