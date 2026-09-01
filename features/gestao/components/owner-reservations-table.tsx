import Link from 'next/link'
import {
  AlertTriangle,
  BedDouble,
  CalendarCheck,
  Clock3,
  Mail,
  ReceiptText,
  UserRound,
  Users,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { BOOKING_STATUS } from '@/features/reservas'
import { ORIGIN_LABEL } from './origin-labels'
import type { OwnerReservation } from '../types'
import { OwnerReservationActions } from './owner-reservation-actions'

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function fmtDateTime(iso: string | null): string | null {
  if (!iso) return null
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

function fmtCreatedAt(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

export function OwnerReservationsTable({ reservations }: { reservations: OwnerReservation[] }) {
  if (reservations.length === 0) {
    return (
      <EmptyState
        icon={CalendarCheck}
        title="Nenhuma reserva ainda"
        description="Quando um hóspede reservar sua pousada, aparecerá aqui."
      />
    )
  }

  return (
    <div className="space-y-4">
      {reservations.map((reservation) => {
        const status = BOOKING_STATUS[reservation.status]
        const dueAt = fmtDateTime(reservation.paymentDueAt)

        return (
          <Card key={reservation.id} className="p-5">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/dashboard/reservas/${reservation.id}`}
                    className="font-serif text-xl font-semibold text-foreground hover:underline"
                  >
                    {reservation.guestName}
                  </Link>
                  <Badge variant={status.variant} size="sm">
                    {status.label}
                  </Badge>
                  {reservation.needsAttention && (
                    <Badge variant="destructiveSoft" size="sm">
                      <AlertTriangle className="mr-1 size-3" />
                      Atenção
                    </Badge>
                  )}
                  <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
                    {reservation.code}
                  </span>
                  <span className="text-xs text-muted-foreground">{ORIGIN_LABEL[reservation.origin]}</span>
                </div>

                <div className="mt-3 grid gap-3 text-sm text-muted-foreground md:grid-cols-2 xl:grid-cols-3">
                  <span className="inline-flex items-center gap-2">
                    <Mail className="size-4 text-primary" />
                    {reservation.guestEmail}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <BedDouble className="size-4 text-primary" />
                    {reservation.roomName}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <Users className="size-4 text-primary" />
                    {reservation.guests} {reservation.guests === 1 ? 'hóspede' : 'hóspedes'}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <CalendarCheck className="size-4 text-primary" />
                    {fmtDate(reservation.checkin)} - {fmtDate(reservation.checkout)}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <Clock3 className="size-4 text-primary" />
                    {reservation.nights} {reservation.nights === 1 ? 'noite' : 'noites'}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <UserRound className="size-4 text-primary" />
                    Criada em {fmtCreatedAt(reservation.createdAt)}
                  </span>
                </div>

                {reservation.status === 'pending' && (
                  <div className="mt-4 rounded-2xl bg-gold/10 p-3 text-sm text-muted-foreground">
                    Prazo para pagamento:{' '}
                    <strong className="font-semibold text-foreground">
                      {dueAt ?? 'não informado'}
                    </strong>
                    .
                  </div>
                )}
              </div>

              <div className="w-full shrink-0 rounded-2xl border border-border bg-secondary/40 p-4 xl:w-64">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <ReceiptText className="size-4 text-primary" />
                  Valores
                </div>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Estadia</span>
                    <span>R$ {reservation.subtotal}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Taxa</span>
                    <span>R$ {reservation.fee}</span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-2 text-base font-semibold text-foreground">
                    <span>Total</span>
                    <span>R$ {reservation.total}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Saldo previsto</span>
                    <span>R$ {reservation.balanceDue}</span>
                  </div>
                </div>

                <div className="mt-4">
                  <OwnerReservationActions
                    bookingId={reservation.id}
                    currentStatus={reservation.status}
                    paymentDueAt={reservation.paymentDueAt}
                  />
                </div>
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
