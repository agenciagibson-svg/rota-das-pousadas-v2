import { sectionDenied } from '@/lib/auth/section-guard'
import { NoSectionAccess } from '@/components/dashboard/no-section-access'
import {
  getCurrentUser,
  getOwnerPousada,
  getOwnerRooms,
  getRateRules,
  canManageAccommodations,
} from '@/server/queries'
import { RatesView } from '@/features/acomodacoes'
import { pousadaToday } from '@/features/dashboard/metrics'

export default async function DashboardTarifasPage() {
  if (await sectionDenied('tarifas'))
    return <NoSectionAccess section="acomodacoes" title="Tarifas" />

  const [user, pousada, rules, rooms, canManage] = await Promise.all([
    getCurrentUser(),
    getOwnerPousada(),
    getRateRules(),
    // A recepção não lê a lista completa de acomodações em todos os casos;
    // sem ela o formulário só não mostra o exemplo de preço.
    getOwnerRooms().catch(() => []),
    canManageAccommodations(),
  ])
  const displayName = user?.name || user?.email || 'Proprietário'

  return (
    <RatesView
      displayName={displayName}
      pousadaName={pousada?.name ?? 'Sua pousada'}
      rules={rules}
      rooms={rooms
        .filter((r) => r.status === 'active')
        .map((r) => ({ id: r.id, name: r.name, basePrice: r.basePrice }))}
      canManage={canManage}
      todayISO={pousadaToday(new Date(), pousada?.timezone ?? 'America/Sao_Paulo').iso}
    />
  )
}
