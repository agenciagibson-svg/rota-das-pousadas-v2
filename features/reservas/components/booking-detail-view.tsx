import Link from 'next/link'
import { DashboardShell } from '@/components/dashboard/shell'
import { ownerDashboardNav } from '@/components/dashboard/owner-nav'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ORIGIN_LABEL } from '@/features/gestao/components/origin-labels'
import { OwnerReservationActions } from '@/features/gestao/components/owner-reservation-actions'
import { BOOKING_STATUS } from '../status'
import { isFinalStatus } from '../status'
import { BookingEditPanel, BookingCompanionsPanel } from './booking-edit-panel'
import type { BookingDetail } from '../types'

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}

export function BookingDetailView({
  displayName,
  pousadaName,
  booking,
}: {
  displayName: string
  pousadaName: string
  booking: BookingDetail
}) {
  const status = BOOKING_STATUS[booking.status]
  const canEdit = !isFinalStatus(booking.status)

  return (
    <DashboardShell
      nav={ownerDashboardNav('reservas')}
      brandLabel={pousadaName}
      brandSub="Painel do proprietário"
      title={`Reserva ${booking.code}`}
      subtitle={booking.roomName}
      user={{ name: displayName, role: 'Proprietário' }}
    >
      <div className="space-y-5">
        <Card className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Badge variant={status.variant}>{status.label}</Badge>
              <span className="text-sm text-muted-foreground">{ORIGIN_LABEL[booking.origin]}</span>
              {booking.externalCode && <span className="text-xs text-muted-foreground">Código externo: {booking.externalCode}</span>}
            </div>
            <OwnerReservationActions bookingId={booking.id} currentStatus={booking.status} paymentDueAt={booking.paymentDueAt} checkin={booking.checkin} />
          </div>
          {booking.status === 'cancelled' && booking.cancellationReason && (
            <p className="mt-3 text-sm text-muted-foreground">Motivo do cancelamento: {booking.cancellationReason}</p>
          )}
          {booking.status === 'no_show' && booking.noShowReason && (
            <p className="mt-3 text-sm text-muted-foreground">Motivo do no-show: {booking.noShowReason}</p>
          )}
        </Card>

        <div className="grid gap-5 xl:grid-cols-2">
          <Card className="p-6">
            <h2 className="font-semibold text-foreground">Hóspede responsável</h2>
            <div className="mt-3 space-y-1 text-sm text-muted-foreground">
              <p className="text-foreground">
                <Link href={`/dashboard/hospedes/${booking.responsibleGuestId}`} className="font-medium hover:underline">
                  {booking.guestName}
                </Link>
              </p>
              <p>{booking.guestEmail ?? 'E-mail não informado'}</p>
              <p>{booking.guestPhone ?? 'Telefone não informado'}</p>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="font-semibold text-foreground">Acomodação e período</h2>
            <div className="mt-3 space-y-1 text-sm text-muted-foreground">
              <p className="text-foreground">{booking.roomName}</p>
              <p>{fmtDate(booking.checkin)} – {fmtDate(booking.checkout)} · {booking.nights} {booking.nights === 1 ? 'noite' : 'noites'}</p>
              <p>{booking.adults} adultos, {booking.children} crianças, {booking.infants} bebês{booking.pets ? ' · com pet' : ''}</p>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="font-semibold text-foreground">Valores previstos</h2>
            <div className="mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between text-muted-foreground"><span>Estadia</span><span>R$ {booking.subtotal}</span></div>
              {/* Reservas anteriores a 13/09/2026 guardam a taxa de serviço que foi cobrada; novas nascem com fee = 0. */}
              {booking.fee > 0 && <div className="flex justify-between text-muted-foreground"><span>Taxa</span><span>R$ {booking.fee}</span></div>}
              {booking.discount > 0 && <div className="flex justify-between text-muted-foreground"><span>Desconto</span><span>−R$ {booking.discount}</span></div>}
              {booking.surcharge > 0 && <div className="flex justify-between text-muted-foreground"><span>Acréscimo</span><span>R$ {booking.surcharge}</span></div>}
              {booking.servicesAmount > 0 && <div className="flex justify-between text-muted-foreground"><span>Serviços</span><span>R$ {booking.servicesAmount}</span></div>}
              <div className="flex justify-between border-t border-border pt-1.5 font-semibold text-foreground"><span>Total</span><span>R$ {booking.total}</span></div>
              <div className="flex justify-between text-muted-foreground"><span>Recebido</span><span>R$ {booking.amountReceived}</span></div>
              <div className="flex justify-between font-semibold text-foreground"><span>Saldo previsto</span><span>R$ {booking.balanceDue}</span></div>
            </div>
            {booking.paymentDueAt && (
              <p className="mt-3 text-xs text-muted-foreground">Prazo de pagamento: {fmtDateTime(booking.paymentDueAt)}</p>
            )}
          </Card>

          <Card className="p-6">
            <h2 className="font-semibold text-foreground">Solicitações e observações</h2>
            <div className="mt-3 space-y-3 text-sm">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Solicitações do hóspede</p>
                <p className="text-foreground">{booking.specialRequests || '—'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Observações internas (nunca visível ao hóspede)</p>
                <p className="text-foreground">{booking.internalNotes || '—'}</p>
              </div>
            </div>
          </Card>
        </div>

        <Card className="p-6">
          <h2 className="font-semibold text-foreground">Acompanhantes</h2>
          <p className="text-sm text-muted-foreground">Responsável + acompanhantes cadastrados nesta reserva.</p>
          <div className="mt-4">
            <BookingCompanionsPanel booking={booking} canEdit={canEdit} />
          </div>
        </Card>

        {canEdit && (
          <Card className="p-6">
            <h2 className="font-semibold text-foreground">Editar reserva</h2>
            <p className="text-sm text-muted-foreground">Alterar período ou acomodação revalida disponibilidade automaticamente.</p>
            <div className="mt-4">
              <BookingEditPanel booking={booking} canEdit={canEdit} />
            </div>
          </Card>
        )}
      </div>
    </DashboardShell>
  )
}
