import { redirect } from 'next/navigation'
import { getCurrentUser, getPendingPousadas } from '@/server/queries'
import { AdminView } from '@/features/admin/components/admin-view'
import { can } from '@/lib/auth/rbac'

export default async function AdminPage() {
  const user = await getCurrentUser()
  // Acesso fechado: apenas equipe da plataforma (platform_role) entra no admin.
  if (!user?.platformRole) redirect('/dashboard')

  const pending = await getPendingPousadas()

  return (
    <AdminView
      displayName={user.name || user.email}
      pending={pending}
      canCreatePousada={can(user.platformRole, 'pousada:create')}
    />
  )
}
