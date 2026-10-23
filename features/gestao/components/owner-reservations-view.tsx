import Link from 'next/link'
import { Plus } from 'lucide-react'
import { OwnerDashboardShell } from '@/components/dashboard/owner-shell'
import { Card } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { ReservationsCalendar } from './reservations-calendar'
import { OwnerReservationsTable } from './owner-reservations-table'
import { ORIGIN_LABEL } from './origin-labels'
import { BOOKING_STATUS } from '@/features/reservas'
import type { DateRange, RoomDay } from '../calendar'
import type { OwnerReservation } from '../types'
import type { GestaoReservationFilters } from '../schemas'

export function OwnerReservationsView({
  displayName,
  pousadaName,
  reservations,
  calendar,
  filters,
  todayISO,
  canManageBookings = true,
}: {
  displayName: string
  pousadaName: string
  reservations: OwnerReservation[]
  calendar: {
    rooms: { id: string; name: string }[]
    bookings: (DateRange & { roomId: string })[]
    blocks: RoomDay[]
    canBlock: boolean
  }
  filters: GestaoReservationFilters
  /** "Hoje" no fuso da pousada — separa dias passados de livres no calendário. */
  todayISO: string
  /** `booking:manage`: sem ele (financeiro) a lista é só de consulta. */
  canManageBookings?: boolean
}) {
  const hasFilters = Boolean(
    filters.status ||
    filters.origin ||
    filters.guestName ||
    filters.checkinFrom ||
    filters.checkinTo,
  )
  return (
    <OwnerDashboardShell
      section="reservas"
      brandLabel={pousadaName}
      brandSub="Painel do proprietário"
      title="Reservas"
      subtitle="Gerencie reservas e a disponibilidade da sua pousada."
      user={{ name: displayName, role: 'Proprietário' }}
    >
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,340px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <Card className="p-5 sm:p-6 xl:sticky xl:top-24">
          <h2 className="text-foreground font-semibold">Calendário &amp; disponibilidade</h2>
          <p className="text-muted-foreground text-sm">
            {calendar.canBlock
              ? 'Escolha o quarto e clique num dia livre para bloquear (ou bloqueado para liberar).'
              : 'Ocupação e bloqueios por quarto.'}
          </p>
          <div className="mt-5">
            <ReservationsCalendar
              rooms={calendar.rooms}
              bookings={calendar.bookings}
              blocks={calendar.blocks}
              canBlock={calendar.canBlock}
              todayISO={todayISO}
            />
          </div>
        </Card>

        <div className="space-y-5">
          <Card className="p-5">
            <form className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3" method="get">
              <select
                name="status"
                defaultValue={filters.status ?? ''}
                aria-label="Status"
                className="border-input bg-card rounded-lg border px-3 py-2 text-sm"
              >
                <option value="">Todos os status</option>
                {Object.entries(BOOKING_STATUS).map(([value, s]) => (
                  <option key={value} value={value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <select
                name="origin"
                defaultValue={filters.origin ?? ''}
                aria-label="Origem"
                className="border-input bg-card rounded-lg border px-3 py-2 text-sm"
              >
                <option value="">Todas as origens</option>
                {Object.entries(ORIGIN_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <input
                name="guestName"
                defaultValue={filters.guestName ?? ''}
                placeholder="Nome do hóspede"
                aria-label="Nome do hóspede"
                className="border-input bg-card rounded-lg border px-3 py-2 text-sm"
              />
              <label className="text-muted-foreground flex items-center gap-2 text-xs">
                <span className="w-16 shrink-0">Entrada de</span>
                <input
                  name="checkinFrom"
                  type="date"
                  defaultValue={filters.checkinFrom ?? ''}
                  className="border-input bg-card text-foreground min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm"
                />
              </label>
              <label className="text-muted-foreground flex items-center gap-2 text-xs">
                <span className="w-16 shrink-0">até</span>
                <input
                  name="checkinTo"
                  type="date"
                  defaultValue={filters.checkinTo ?? ''}
                  className="border-input bg-card text-foreground min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm"
                />
              </label>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="bg-primary text-primary-foreground flex-1 rounded-lg px-3 py-2 text-sm font-semibold"
                >
                  Filtrar
                </button>
                {hasFilters && (
                  <Link
                    href="/dashboard/reservas"
                    className="border-border text-muted-foreground hover:bg-secondary rounded-lg border px-3 py-2 text-sm font-medium"
                  >
                    Limpar
                  </Link>
                )}
              </div>
            </form>
          </Card>

          <Card className="p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-foreground font-semibold">Todas as reservas</h2>
                <p className="text-muted-foreground text-sm">
                  {reservations.length === 1 ? '1 reserva' : `${reservations.length} reservas`}
                  {hasFilters ? ' com esses filtros' : ''}
                </p>
              </div>
              {canManageBookings && (
                <Link href="/dashboard/reservas/nova" className={buttonVariants({ size: 'sm' })}>
                  <Plus className="size-4" />
                  Nova reserva
                </Link>
              )}
            </div>
            <div className="mt-4">
              <OwnerReservationsTable reservations={reservations} todayISO={todayISO} />
            </div>
          </Card>
        </div>
      </div>
    </OwnerDashboardShell>
  )
}
