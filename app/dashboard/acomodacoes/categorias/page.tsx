import { sectionDenied } from '@/lib/auth/section-guard'
import { NoSectionAccess } from '@/components/dashboard/no-section-access'
import {
  getCurrentUser,
  getOwnerPousada,
  getOwnerCategories,
  canManageAccommodations,
} from '@/server/queries'
import { CategoriesView } from '@/features/acomodacoes'

export default async function DashboardCategoriasPage() {
  if (await sectionDenied('categorias'))
    return <NoSectionAccess section="acomodacoes" title="Categorias" />

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
