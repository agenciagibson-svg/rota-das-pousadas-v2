import Link from 'next/link'
import { Plus } from 'lucide-react'
import { OwnerDashboardShell } from '@/components/dashboard/owner-shell'
import { Card } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { ReservationsCalendar } from './reservations-calendar'
import { OwnerReservationsTable } from './owner-reservations-table'
import { ORIGIN_LABEL } from './origin-labels'
import { BOOKING_STATUS } from '@/features/reservas'
import type { DateRange } from '../calendar'
import type { OwnerReservation } from '../types'
import type { GestaoReservationFilters } from '../schemas'

export function OwnerReservationsView({
  displayName,
  pousadaName,
  reservations,
  occupied,
  blocked,
  filters,
  todayISO,
}: {
  displayName: string
  pousadaName: string
  reservations: OwnerReservation[]
  occupied: DateRange[]
  blocked: string[]
  filters: GestaoReservationFilters
  /** "Hoje" no fuso da pousada — separa dias passados de livres no calendário. */
  todayISO: string
}) {
  return (
    <OwnerDashboardShell
      section="reservas"
      brandLabel={pousadaName}
      brandSub="Painel do proprietário"
      title="Reservas"
      subtitle="Gerencie reservas e a disponibilidade da sua pousada."
      user={{ name: displayName, role: 'Proprietário' }}
    >
      <div className="grid grid-cols-1 gap-5 2xl:grid-cols-[0.95fr_1.35fr]">
        <Card className="p-6">
          <h2 className="text-foreground font-semibold">Calendário &amp; disponibilidade</h2>
          <p className="text-muted-foreground text-sm">Clique em um dia livre para bloquear.</p>
          <div className="mt-5">
            <ReservationsCalendar occupied={occupied} blocked={blocked} todayISO={todayISO} />
          </div>
        </Card>

        <div className="space-y-5">
          <Card className="p-5">
            <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" method="get">
              <select
                name="status"
                defaultValue={filters.status ?? ''}
                className="border-input bg-card rounded-lg border px-3 py-2 text-sm"
              >
                <option value="">Status (todos)</option>
                {Object.entries(BOOKING_STATUS).map(([value, s]) => (
                  <option key={value} value={value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <select
                name="origin"
                defaultValue={filters.origin ?? ''}
                className="border-input bg-card rounded-lg border px-3 py-2 text-sm"
              >
                <option value="">Origem (todas)</option>
                {Object.entries(ORIGIN_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <input
                name="guestName"
                defaultValue={filters.guestName ?? ''}
                placeholder="Hóspede"
                className="border-input bg-card rounded-lg border px-3 py-2 text-sm"
              />
              <input
                name="checkinFrom"
                type="date"
                defaultValue={filters.checkinFrom ?? ''}
                className="border-input bg-card rounded-lg border px-3 py-2 text-sm"
              />
              <input
                name="checkinTo"
                type="date"
                defaultValue={filters.checkinTo ?? ''}
                className="border-input bg-card rounded-lg border px-3 py-2 text-sm"
              />
              <button
                type="submit"
                className="bg-primary text-primary-foreground rounded-lg px-3 py-2 text-sm font-semibold"
              >
                Filtrar
              </button>
            </form>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-foreground font-semibold">Todas as reservas</h2>
                <p className="text-muted-foreground text-sm">{reservations.length} no total.</p>
              </div>
              <Link href="/dashboard/reservas/nova" className={buttonVariants({ size: 'sm' })}>
                <Plus className="size-4" />
                Nova reserva
              </Link>
            </div>
            <div className="mt-4">
              <OwnerReservationsTable reservations={reservations} />
            </div>
          </Card>
        </div>
      </div>
    </OwnerDashboardShell>
  )
}
