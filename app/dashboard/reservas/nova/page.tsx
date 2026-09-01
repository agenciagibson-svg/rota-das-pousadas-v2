import { getCurrentUser, getOwnerPousada, getOwnerRooms } from '@/server/queries'
import { DashboardShell } from '@/components/dashboard/shell'
import { ownerDashboardNav } from '@/components/dashboard/owner-nav'
import { Card } from '@/components/ui/card'
import { NewBookingForm } from '@/features/reservas/components/new-booking-form'

export default async function NewBookingPage() {
  const [user, pousada, rooms] = await Promise.all([getCurrentUser(), getOwnerPousada(), getOwnerRooms()])
  const displayName = user?.name || user?.email || 'Proprietário'

  return (
    <DashboardShell
      nav={ownerDashboardNav('reservas')}
      brandLabel={pousada?.name ?? 'Sua pousada'}
      brandSub="Painel do proprietário"
      title="Nova reserva"
      subtitle="Consulte disponibilidade real e crie a reserva."
      user={{ name: displayName, role: 'Proprietário' }}
    >
      {rooms.length === 0 ? (
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">
            Cadastre ao menos uma acomodação ativa em Acomodações antes de criar reservas.
          </p>
        </Card>
      ) : (
        <NewBookingForm rooms={rooms} />
      )}
    </DashboardShell>
  )
}
