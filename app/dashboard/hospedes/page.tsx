import { getCurrentUser, getOwnerPousada, getOwnerGuests } from '@/server/queries'
import { GuestsView } from '@/features/hospedes'
import type { GuestFilters } from '@/features/hospedes/schemas'

export default async function DashboardHospedesPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string; email?: string; phone?: string; document?: string; recurrentOnly?: string; incompleteOnly?: string }>
}) {
  const params = await searchParams
  const filters: GuestFilters = {
    name: params.name || undefined,
    email: params.email || undefined,
    phone: params.phone || undefined,
    document: params.document || undefined,
    recurrentOnly: params.recurrentOnly === '1',
    incompleteOnly: params.incompleteOnly === '1',
  }

  const [user, pousada, guests] = await Promise.all([getCurrentUser(), getOwnerPousada(), getOwnerGuests(filters)])
  const displayName = user?.name || user?.email || 'Proprietário'

  return (
    <GuestsView displayName={displayName} pousadaName={pousada?.name ?? 'Sua pousada'} guests={guests} filters={filters} />
  )
}
