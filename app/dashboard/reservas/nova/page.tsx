import { sectionDenied } from '@/lib/auth/section-guard'
import { NoSectionAccess } from '@/components/dashboard/no-section-access'
import { getCurrentUser, getOwnerPousada, getOwnerRooms } from '@/server/queries'
import { OwnerDashboardShell } from '@/components/dashboard/owner-shell'
import { Card } from '@/components/ui/card'
import { NewBookingForm } from '@/features/reservas/components/new-booking-form'

export default async function NewBookingPage() {
  if (await sectionDenied('nova_reserva'))
    return <NoSectionAccess section="reservas" title="Nova reserva" />

  const [user, pousada, rooms] = await Promise.all([
    getCurrentUser(),
    getOwnerPousada(),
    getOwnerRooms(),
  ])
  const displayName = user?.name || user?.email || 'Proprietário'

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
        <NewBookingForm rooms={rooms} />
      )}
    </OwnerDashboardShell>
  )
}
