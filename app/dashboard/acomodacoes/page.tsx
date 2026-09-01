import {
  getCurrentUser,
  getOwnerPousada,
  getOwnerRooms,
  getHousekeepingRooms,
  getOwnerCategories,
  getAmenitiesCatalog,
  canManageAccommodations,
  canChangeOperationalStatus,
  getActiveRole,
} from '@/server/queries'
import { RoomsView, HousekeepingRoomsView } from '@/features/acomodacoes'

export default async function DashboardAcomodacoesPage() {
  const [user, pousada, role] = await Promise.all([getCurrentUser(), getOwnerPousada(), getActiveRole()])
  const displayName = user?.name || user?.email || 'Proprietário'
  const pousadaName = pousada?.name ?? 'Sua pousada'

  // [Ciclo 3B] Governança nunca chama a leitura completa de `rooms` — nem a
  // RLS concederia. Usa exclusivamente a projeção operacional mínima.
  if (role === 'governanca') {
    const rooms = await getHousekeepingRooms()
    return <HousekeepingRoomsView displayName={displayName} pousadaName={pousadaName} rooms={rooms} />
  }

  const [rooms, categories, amenities, canManage, canChangeStatus] = await Promise.all([
    getOwnerRooms(),
    getOwnerCategories(),
    getAmenitiesCatalog(),
    canManageAccommodations(),
    canChangeOperationalStatus(),
  ])

  return (
    <RoomsView
      displayName={displayName}
      pousadaName={pousadaName}
      rooms={rooms}
      categories={categories}
      amenities={amenities}
      canManage={canManage}
      canChangeOperationalStatus={canChangeStatus}
    />
  )
}
