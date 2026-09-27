import { Lock } from 'lucide-react'
import { OwnerDashboardShell } from './owner-shell'
import { EmptyState } from '@/components/ui/empty-state'
import { getCurrentUser, getOwnerPousada } from '@/server/queries'
import type { OwnerDashboardSection } from './owner-nav'

/** Página do painel que o papel da pessoa não pode abrir: explica em vez de quebrar. */
export async function NoSectionAccess({
  section,
  title,
}: {
  section: OwnerDashboardSection
  title: string
}) {
  const [user, pousada] = await Promise.all([getCurrentUser(), getOwnerPousada().catch(() => null)])
  return (
    <OwnerDashboardShell
      section={section}
      brandLabel={pousada?.name ?? 'Sua pousada'}
      brandSub="Painel da pousada"
      title={title}
      subtitle="Área restrita"
      user={{ name: user?.name || user?.email || 'Equipe', role: '' }}
    >
      <EmptyState
        icon={Lock}
        title="Seu perfil não tem acesso a esta área"
        description="Peça ao proprietário da pousada para ajustar o seu papel em Membros, se precisar usar esta parte do painel."
      />
    </OwnerDashboardShell>
  )
}
