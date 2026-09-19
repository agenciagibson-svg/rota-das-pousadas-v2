import type { Metadata } from 'next'
import { AdminShell } from '@/features/admin/components/admin-shell'
import { Card } from '@/components/ui/card'
import { DestinationsManager } from '@/features/admin/components/destinations-manager'
import {
  listDestinationsAdmin,
  canManageDestinations,
} from '@/features/admin/services/admin.service'
import { getCurrentUser } from '@/server/queries'

export const metadata: Metadata = {
  title: 'Destinos — Admin',
  robots: { index: false, follow: false },
}

export default async function AdminDestinosPage() {
  const [user, destinations, canManage] = await Promise.all([
    getCurrentUser(),
    listDestinationsAdmin(),
    canManageDestinations(),
  ])

  return (
    <AdminShell
      active="destinos"
      title="Destinos"
      subtitle="Curadoria de destinos da plataforma"
      displayName={user?.name || user?.email || 'Equipe'}
    >
      <Card className="p-6">
        <DestinationsManager items={destinations} canManage={canManage} />
      </Card>
    </AdminShell>
  )
}
