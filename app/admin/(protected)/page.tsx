import { getCurrentUser, getPendingPousadas } from '@/server/queries'
import { AdminView } from '@/features/admin/components/admin-view'
import { can } from '@/lib/auth/rbac'

export default async function AdminPage() {
  // O layout do grupo protegido já garante `platformRole` — aqui só buscamos os dados.
  const user = await getCurrentUser()
  const pending = await getPendingPousadas()

  return (
    <AdminView
      displayName={user?.name || user?.email || 'Equipe'}
      pending={pending}
      canCreatePousada={Boolean(user?.platformRole && can(user.platformRole, 'pousada:create'))}
    />
  )
}
