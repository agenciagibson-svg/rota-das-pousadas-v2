import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/server/queries'
import { AdminAccessDenied } from '@/components/admin/access-denied'

/**
 * Guarda de acesso do painel administrativo — antes espalhada por página
 * (`if (!user?.platformRole) redirect(...)` repetido em cada uma). Fica só
 * neste grupo protegido, não em `/admin/login` (que precisa ser alcançável
 * por quem ainda não tem sessão nenhuma).
 */
export default async function AdminProtectedLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect('/admin/login')
  if (!user.platformRole) return <AdminAccessDenied />

  return <>{children}</>
}
