import Link from 'next/link'
import { AlertTriangle, BedDouble, CalendarCheck, Clock3, Mail, ReceiptText } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { BOOKING_STATUS } from '@/features/reservas'
import { ORIGIN_LABEL } from './origin-labels'
import type { OwnerReservation } from '../types'
import { formatBRL, formatDateTime, formatISODate, isEmail, plural } from '@/lib/format'
import { OwnerReservationActions } from './owner-reservation-actions'

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
        const dueAt = reservation.paymentDueAt ? formatDateTime(reservation.paymentDueAt) : null
        const hasEmail = isEmail(reservation.guestEmail)

        return (
          // @container: o cartão se ajusta ao espaço que recebe (lista larga em
          // Reservas, coluna estreita na Visão geral), não à largura da tela.
          <Card key={reservation.id} className="@container p-4 sm:p-5">
            <div className="flex flex-col gap-4 @2xl:flex-row @2xl:items-start @2xl:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                  <Link
                    href={`/dashboard/reservas/${reservation.id}`}
                    className="text-foreground font-display min-w-0 truncate text-lg font-medium hover:underline sm:text-xl"
                  >
                    {reservation.guestName}
                  </Link>
                  <Badge variant={status.variant} size="sm">
                    {status.label}
                  </Badge>
                  {reservation.proofPending && (
                    <Badge variant="goldSoft" size="sm">
                      Pix para aprovar
                    </Badge>
                  )}
                  {reservation.needsAttention && (
                    <Badge variant="destructiveSoft" size="sm">
                      <AlertTriangle className="mr-1 size-3" />
                      Prazo vencido
                    </Badge>
                  )}
                </div>
                <div className="text-muted-foreground mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                  <span className="bg-secondary rounded-full px-2.5 py-0.5 font-medium">
                    {reservation.code}
                  </span>
                  <span>{ORIGIN_LABEL[reservation.origin]}</span>
                  <span aria-hidden="true">·</span>
                  <span>Criada em {formatDateTime(reservation.createdAt)}</span>
                </div>

                <dl className="text-muted-foreground mt-3 grid gap-x-5 gap-y-2 text-sm @md:grid-cols-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <CalendarCheck className="text-primary size-4 shrink-0" />
                    <dt className="sr-only">Período</dt>
                    <dd className="text-foreground whitespace-nowrap">
                      {formatISODate(reservation.checkin)} → {formatISODate(reservation.checkout)}
                    </dd>
                  </div>
                  <div className="flex min-w-0 items-center gap-2">
                    <Clock3 className="text-primary size-4 shrink-0" />
                    <dt className="sr-only">Noites e hóspedes</dt>
                    <dd className="truncate">
                      {plural(reservation.nights, 'noite', 'noites')} ·{' '}
                      {plural(reservation.guests, 'hóspede', 'hóspedes')}
                    </dd>
                  </div>
                  <div className="flex min-w-0 items-center gap-2">
                    <BedDouble className="text-primary size-4 shrink-0" />
                    <dt className="sr-only">Acomodação</dt>
                    <dd className="truncate" title={reservation.roomName}>
                      {reservation.roomName}
                    </dd>
                  </div>
                  <div className="flex min-w-0 items-center gap-2">
                    <Mail className="text-primary size-4 shrink-0" />
                    <dt className="sr-only">E-mail</dt>
                    <dd
                      className="min-w-0 truncate"
                      title={hasEmail ? reservation.guestEmail : undefined}
                    >
                      {hasEmail ? (
                        <a
                          href={`mailto:${reservation.guestEmail}`}
                          className="hover:text-foreground hover:underline"
                        >
                          {reservation.guestEmail}
                        </a>
                      ) : (
                        'Sem e-mail'
                      )}
                    </dd>
                  </div>
                </dl>

                {reservation.status === 'pending' && reservation.proofPending && (
                  <Link
                    href={`/dashboard/reservas/${reservation.id}`}
                    className="border-ipe/50 bg-ipe/15 text-foreground hover:bg-ipe/25 mt-4 block rounded-2xl border p-3 text-sm font-medium"
                  >
                    O hóspede enviou o comprovante do Pix. Confira na conta e aprove →
                  </Link>
                )}
                {reservation.status === 'pending' && !reservation.proofPending && (
                  <div className="bg-gold/10 text-muted-foreground mt-4 rounded-2xl p-3 text-sm">
                    Prazo para pagamento:{' '}
                    <strong className="text-foreground font-semibold">
                      {dueAt ?? 'não informado'}
                    </strong>
                    .
                  </div>
                )}
              </div>

              <div className="border-border bg-secondary/40 w-full shrink-0 rounded-2xl border p-4 @2xl:w-60">
                <div className="text-foreground flex items-center gap-2 text-sm font-semibold">
                  <ReceiptText className="text-primary size-4" />
                  Valores
                </div>
                <div className="mt-3 space-y-1.5 text-sm">
                  <div className="text-muted-foreground flex justify-between gap-3">
                    <span>Estadia</span>
                    <span className="whitespace-nowrap">{formatBRL(reservation.subtotal)}</span>
                  </div>
                  {reservation.fee > 0 && (
                    <div className="text-muted-foreground flex justify-between gap-3">
                      <span>Taxa</span>
                      <span className="whitespace-nowrap">{formatBRL(reservation.fee)}</span>
                    </div>
                  )}
                  <div className="border-border text-foreground flex justify-between gap-3 border-t pt-2 text-base font-semibold">
                    <span>Total</span>
                    <span className="whitespace-nowrap">{formatBRL(reservation.total)}</span>
                  </div>
                  {/* Cancelada/no-show não tem nada a receber — o saldo antigo confundia. */}
                  {reservation.status === 'cancelled' || reservation.status === 'no_show' ? (
                    <div className="text-muted-foreground flex justify-between gap-3">
                      <span>Situação</span>
                      <span>Sem cobrança</span>
                    </div>
                  ) : (
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">
                        {reservation.balanceDue > 0 ? 'Falta receber' : 'Pago'}
                      </span>
                      <span
                        className={
                          reservation.balanceDue > 0
                            ? 'text-foreground font-semibold whitespace-nowrap'
                            : 'text-success font-semibold whitespace-nowrap'
                        }
                      >
                        {reservation.balanceDue > 0 ? formatBRL(reservation.balanceDue) : '✓'}
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-4">
                  <OwnerReservationActions
                    bookingId={reservation.id}
                    currentStatus={reservation.status}
                    paymentDueAt={reservation.paymentDueAt}
                    checkin={reservation.checkin}
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
