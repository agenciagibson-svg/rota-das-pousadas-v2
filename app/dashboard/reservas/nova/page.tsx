import { sectionDenied } from '@/lib/auth/section-guard'
import { NoSectionAccess } from '@/components/dashboard/no-section-access'
import { getCurrentUser, getOwnerPousada, getOwnerRooms } from '@/server/queries'
import { OwnerDashboardShell } from '@/components/dashboard/owner-shell'
import { Card } from '@/components/ui/card'
import { NewBookingForm } from '@/features/reservas/components/new-booking-form'
import { parseNewBookingPrefill } from '@/features/gestao'

export default async function NewBookingPage({
  searchParams,
}: {
  // Do mapa de ocupação: ?quarto=<id>&entrada=AAAA-MM-DD&saida=AAAA-MM-DD
  searchParams: Promise<{ quarto?: string; entrada?: string; saida?: string }>
}) {
  if (await sectionDenied('nova_reserva'))
    return <NoSectionAccess section="reservas" title="Nova reserva" />

  const [user, pousada, rooms, params] = await Promise.all([
    getCurrentUser(),
    getOwnerPousada(),
    getOwnerRooms(),
    searchParams,
  ])
  const displayName = user?.name || user?.email || 'Proprietário'
  const initial = parseNewBookingPrefill(
    params,
    rooms.map((r) => r.id),
  )

  return (
    <OwnerDashboardShell
      section="reservas"
      brandLabel={pousada?.name ?? 'Sua pousada'}
      brandSub="Painel do proprietário"
      title="Nova reserva"
      subtitle="Consulte disponibilidade real e crie a reserva."
      user={{ name: displayName, role: 'Proprietário' }}
    >
      {rooms.length === 0 ? (
        <Card className="p-6">
          <p className="text-muted-foreground text-sm">
            Cadastre ao menos uma acomodação ativa em Acomodações antes de criar reservas.
          </p>
        </Card>
      ) : (
        <NewBookingForm rooms={rooms} initial={initial} />
      )}
    </OwnerDashboardShell>
  )
}
