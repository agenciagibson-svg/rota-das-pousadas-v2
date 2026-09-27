import { sectionDenied } from '@/lib/auth/section-guard'
import { NoSectionAccess } from '@/components/dashboard/no-section-access'
import { getCurrentUser, getOwnerPousada, getOwnerCategories } from '@/server/queries'
import { AvailabilityView } from '@/features/acomodacoes'

export default async function DashboardDisponibilidadePage() {
  if (await sectionDenied('disponibilidade'))
    return <NoSectionAccess section="acomodacoes" title="Disponibilidade" />

  const [user, pousada, categories] = await Promise.all([
    getCurrentUser(),
    getOwnerPousada(),
    getOwnerCategories(),
  ])

  const displayName = user?.name || user?.email || 'Proprietário'

  return (
    <AvailabilityView
      displayName={displayName}
      pousadaName={pousada?.name ?? 'Sua pousada'}
      categories={categories}
    />
  )
}
