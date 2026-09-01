import { getCurrentUser, getOwnerPousada, getOwnerCategories } from '@/server/queries'
import { AvailabilityView } from '@/features/acomodacoes'

export default async function DashboardDisponibilidadePage() {
  const [user, pousada, categories] = await Promise.all([getCurrentUser(), getOwnerPousada(), getOwnerCategories()])

  const displayName = user?.name || user?.email || 'Proprietário'

  return <AvailabilityView displayName={displayName} pousadaName={pousada?.name ?? 'Sua pousada'} categories={categories} />
}
