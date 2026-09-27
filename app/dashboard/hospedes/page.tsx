import { sectionDenied } from '@/lib/auth/section-guard'
import { NoSectionAccess } from '@/components/dashboard/no-section-access'
import { getCurrentUser, getOwnerPousada, getOwnerGuests } from '@/server/queries'
import { GuestsView } from '@/features/hospedes'
import type { GuestFilters } from '@/features/hospedes/schemas'

export default async function DashboardHospedesPage({
  searchParams,
}: {
  searchParams: Promise<{
    name?: string
    email?: string
    phone?: string
    document?: string
    recurrentOnly?: string
    incompleteOnly?: string
  }>
}) {
  if (await sectionDenied('hospedes'))
    return <NoSectionAccess section="hospedes" title="Hóspedes" />

  const params = await searchParams
  const filters: GuestFilters = {
    name: params.name || undefined,
    email: params.email || undefined,
    phone: params.phone || undefined,
    document: params.document || undefined,
    recurrentOnly: params.recurrentOnly === '1',
    incompleteOnly: params.incompleteOnly === '1',
  }

  const [user, pousada, guests] = await Promise.all([
    getCurrentUser(),
    getOwnerPousada(),
    getOwnerGuests(filters),
  ])
  const displayName = user?.name || user?.email || 'Proprietário'

  return (
    <GuestsView
      displayName={displayName}
      pousadaName={pousada?.name ?? 'Sua pousada'}
      guests={guests}
      filters={filters}
    />
  )
}
