import { sectionDenied } from '@/lib/auth/section-guard'
import { NoSectionAccess } from '@/components/dashboard/no-section-access'
import { getCurrentUser, getOwnerOccupancy, getOwnerPousada } from '@/server/queries'
import { OwnerOccupancyView } from '@/features/gestao'

/**
 * Mapa de ocupação (quartos × noites). Mesmo acesso de "Nova reserva"
 * (`booking:manage`): o financeiro entra em Reservas, mas não move reserva.
 */
export default async function DashboardOcupacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ inicio?: string; dias?: string }>
}) {
  if (await sectionDenied('nova_reserva'))
    return <NoSectionAccess section="reservas" title="Mapa de ocupação" />

  const params = await searchParams
  const [user, pousada, board] = await Promise.all([
    getCurrentUser(),
    getOwnerPousada(),
    getOwnerOccupancy(params.inicio, params.dias),
  ])

  return (
    <OwnerOccupancyView
      displayName={user?.name || user?.email || 'Proprietário'}
      pousadaName={pousada?.name ?? 'Sua pousada'}
      board={board}
    />
  )
}
