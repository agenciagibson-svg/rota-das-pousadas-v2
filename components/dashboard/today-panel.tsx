'use client'

import Link from 'next/link'
import { BedDouble, ConciergeBell, LogIn, LogOut, Sparkles, type LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BOOKING_STATUS } from '@/features/reservas'
import { OwnerReservationActions } from '@/features/gestao/components/owner-reservation-actions'
import type { OwnerReservation } from '@/features/gestao/types'
import { formatBRL, plural } from '@/lib/format'
import { cn } from '@/lib/utils'

export type TodaySummary = {
  /** Data de hoje no fuso da pousada, já formatada ("sexta, 23 de outubro"). */
  dateLabel: string
  arrivals: OwnerReservation[]
  departures: OwnerReservation[]
  inHouse: number
  /** `null` = o papel não vê o status dos quartos. */
  roomsToClean: number | null
  /** `null` = o papel não vê pedidos. */
  newOrders: number | null
}

function Counter({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: LucideIcon
  label: string
  value: number
  href?: string
}) {
  const body = (
    <>
      <Icon className="text-muted-foreground size-5" />
      <span className="text-foreground text-2xl font-semibold tabular-nums">{value}</span>
      <span className="text-muted-foreground text-xs">{label}</span>
    </>
  )
  const cls =
    'bg-secondary/60 flex min-h-24 flex-col justify-between gap-1 rounded-2xl p-3 transition-colors'
  return href ? (
    <Link href={href} className={cn(cls, 'hover:bg-secondary')}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}

function Row({
  reservation,
  kind,
  showMoney,
}: {
  reservation: OwnerReservation
  kind: 'in' | 'out'
  showMoney: boolean
}) {
  const status = BOOKING_STATUS[reservation.status]
  return (
    <li className="border-border flex flex-col gap-3 border-t py-3 first:border-t-0 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/dashboard/reservas/${reservation.id}`}
            className="text-foreground truncate font-semibold hover:underline"
          >
            {reservation.guestName}
          </Link>
          <Badge variant={status.variant} size="sm">
            {status.label}
          </Badge>
        </div>
        <p className="text-muted-foreground text-sm">
          {reservation.roomName} · {plural(reservation.nights, 'noite', 'noites')} ·{' '}
          {plural(reservation.guests, 'hóspede', 'hóspedes')}
        </p>
        {kind === 'out' && showMoney && reservation.balanceDue > 0 && (
          <p className="text-foreground text-sm font-medium">
            Falta receber {formatBRL(reservation.balanceDue)}
          </p>
        )}
      </div>
      <div className="shrink-0 sm:w-56">
        <OwnerReservationActions
          bookingId={reservation.id}
          currentStatus={reservation.status}
          paymentDueAt={reservation.paymentDueAt}
          checkin={reservation.checkin}
          guestName={reservation.guestName}
          balanceDue={reservation.balanceDue}
        />
      </div>
    </li>
  )
}

/**
 * "Hoje": a primeira coisa do painel. Quem abre o painel quer saber o que fazer
 * agora (quem chega, quem sai, o que arrumar), com o botão da ação ali mesmo.
 * Gráficos ficam abaixo.
 */
export function TodayPanel({ today, showMoney }: { today: TodaySummary; showMoney: boolean }) {
  // Saída de hoje que ainda não fez check-in não é "saída": é reserva com problema
  // e já aparece em Reservas. Aqui só quem está hospedado.
  const departures = today.departures.filter((r) => r.status === 'checked_in')
  const arrivals = today.arrivals.filter((r) => r.status !== 'checked_in')

  return (
    <Card className="mb-5 p-5" aria-labelledby="hoje-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="hoje-title" className="text-foreground font-display text-xl font-medium">
          Hoje
        </h2>
        <span className="text-muted-foreground text-sm first-letter:uppercase">
          {today.dateLabel}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Counter icon={LogIn} label="chegadas" value={arrivals.length} />
        <Counter icon={LogOut} label="saídas" value={departures.length} />
        <Counter icon={BedDouble} label="hospedados agora" value={today.inHouse} />
        {today.newOrders !== null ? (
          <Counter
            icon={ConciergeBell}
            label="pedidos novos"
            value={today.newOrders}
            href="/dashboard/pedidos"
          />
        ) : today.roomsToClean !== null ? (
          <Counter
            icon={Sparkles}
            label="quartos para arrumar"
            value={today.roomsToClean}
            href="/dashboard/acomodacoes"
          />
        ) : null}
      </div>

      {arrivals.length === 0 && departures.length === 0 ? (
        <p className="text-muted-foreground mt-4 text-sm">Nenhuma chegada ou saída hoje.</p>
      ) : (
        <div className="mt-4 grid gap-5 lg:grid-cols-2">
          {arrivals.length > 0 && (
            <section aria-label="Chegadas de hoje">
              <h3 className="text-foreground text-sm font-semibold">Chegam hoje</h3>
              <ul>
                {arrivals.map((r) => (
                  <Row key={r.id} reservation={r} kind="in" showMoney={showMoney} />
                ))}
              </ul>
            </section>
          )}
          {departures.length > 0 && (
            <section aria-label="Saídas de hoje">
              <h3 className="text-foreground text-sm font-semibold">Saem hoje</h3>
              <ul>
                {departures.map((r) => (
                  <Row key={r.id} reservation={r} kind="out" showMoney={showMoney} />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </Card>
  )
}
