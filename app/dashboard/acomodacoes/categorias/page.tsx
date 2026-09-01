import { getCurrentUser, getOwnerPousada, getOwnerCategories, canManageAccommodations } from '@/server/queries'
import { CategoriesView } from '@/features/acomodacoes'

export default async function DashboardCategoriasPage() {
  const [user, pousada, categories, canManage] = await Promise.all([
    getCurrentUser(),
    getOwnerPousada(),
    getOwnerCategories(),
    canManageAccommodations(),
  ])

  const displayName = user?.name || user?.email || 'Proprietário'

  return (
    <CategoriesView
      displayName={displayName}
      pousadaName={pousada?.name ?? 'Sua pousada'}
      categories={categories}
      canManage={canManage}
    />
  )
}
