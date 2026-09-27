import Link from 'next/link'
import { Printer } from 'lucide-react'
import { OwnerDashboardShell } from '@/components/dashboard/owner-shell'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ORIGIN_LABEL } from '@/features/gestao/components/origin-labels'
import { OwnerReservationActions } from '@/features/gestao/components/owner-reservation-actions'
import { BOOKING_STATUS } from '../status'
import { isFinalStatus } from '../status'
import { BookingEditPanel, BookingCompanionsPanel } from './booking-edit-panel'
import type { BookingDetail } from '../types'
import {
  formatBRL,
  formatDateTime,
  formatISODate,
  isEmail,
  plural,
  whatsappLink,
} from '@/lib/format'
import {
  ProofReviewPanel,
  type ProofForReview,
} from '@/features/pagamentos/components/proof-review-panel'

const fmtDate = formatISODate
const fmtDateTime = formatDateTime

export function BookingDetailView({
  displayName,
  pousadaName,
  booking,
  proofs = [],
}: {
  displayName: string
  pousadaName: string
  booking: BookingDetail
  proofs?: ProofForReview[]
}) {
  const status = BOOKING_STATUS[booking.status]
  const canEdit = !isFinalStatus(booking.status)

  return (
    <OwnerDashboardShell
      section="reservas"
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
              <span className="text-muted-foreground text-sm">{ORIGIN_LABEL[booking.origin]}</span>
              {booking.externalCode && (
                <span className="text-muted-foreground text-xs">
                  Código externo: {booking.externalCode}
                </span>
              )}
            </div>
            <OwnerReservationActions
              bookingId={booking.id}
              currentStatus={booking.status}
              paymentDueAt={booking.paymentDueAt}
              checkin={booking.checkin}
            />
          </div>
          {booking.status === 'cancelled' && booking.cancellationReason && (
            <p className="text-muted-foreground mt-3 text-sm">
              Motivo do cancelamento: {booking.cancellationReason}
            </p>
          )}
          {booking.status === 'no_show' && booking.noShowReason && (
            <p className="text-muted-foreground mt-3 text-sm">
              Motivo do no-show: {booking.noShowReason}
            </p>
          )}
        </Card>

        {proofs.length > 0 && (
          <Card
            className={`p-6 ${proofs.some((p) => p.status === 'submitted') ? 'ring-2 ring-amber-300' : ''}`}
          >
            <h2 className="text-foreground font-semibold">Pagamento por Pix direto</h2>
            <p className="text-muted-foreground text-sm">
              Comprovantes enviados pelo hóspede. Aprovar confirma a reserva e envia o comprovante
              por e-mail ao hóspede.
            </p>
            <div className="mt-4">
              <ProofReviewPanel proofs={proofs} canReview={!isFinalStatus(booking.status)} />
            </div>
          </Card>
        )}

        <div className="grid gap-5 lg:grid-cols-2">
          <Card className="p-6">
            <h2 className="text-foreground font-semibold">Hóspede responsável</h2>
            <div className="text-muted-foreground mt-3 space-y-1 text-sm">
              <p className="text-foreground">
                <Link
                  href={`/dashboard/hospedes/${booking.responsibleGuestId}`}
                  className="font-medium hover:underline"
                >
                  {booking.guestName}
                </Link>
              </p>
              {isEmail(booking.guestEmail) ? (
                <p className="truncate">
                  <a
                    href={`mailto:${booking.guestEmail}`}
                    className="hover:text-foreground hover:underline"
                  >
                    {booking.guestEmail}
                  </a>
                </p>
              ) : (
                <p>E-mail não informado</p>
              )}
              {booking.guestPhone ? (
                <p>
                  {whatsappLink(booking.guestPhone) ? (
                    <a
                      href={whatsappLink(booking.guestPhone)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-foreground hover:underline"
                    >
                      {booking.guestPhone} (WhatsApp)
                    </a>
                  ) : (
                    booking.guestPhone
                  )}
                </p>
              ) : (
                <p>
                  Telefone não informado —{' '}
                  <Link
                    href={`/dashboard/hospedes/${booking.responsibleGuestId}`}
                    className="text-primary hover:underline"
                  >
                    completar ficha
                  </Link>
                </p>
              )}
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-foreground font-semibold">Acomodação e período</h2>
            <div className="text-muted-foreground mt-3 space-y-1 text-sm">
              <p className="text-foreground">{booking.roomName}</p>
              <p>
                {fmtDate(booking.checkin)} → {fmtDate(booking.checkout)} ·{' '}
                {plural(booking.nights, 'noite', 'noites')}
              </p>
              <p>
                {plural(booking.adults, 'adulto', 'adultos')}
                {booking.children > 0 ? `, ${plural(booking.children, 'criança', 'crianças')}` : ''}
                {booking.infants > 0 ? `, ${plural(booking.infants, 'bebê', 'bebês')}` : ''}
                {booking.pets ? ' · com pet' : ''}
              </p>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-foreground font-semibold">Valores previstos</h2>
            <div className="mt-3 space-y-1.5 text-sm">
              <div className="text-muted-foreground flex justify-between">
                <span>Estadia</span>
                <span>{formatBRL(booking.subtotal)}</span>
              </div>
              {/* Reservas anteriores a 13/09/2026 guardam a taxa de serviço que foi cobrada; novas nascem com fee = 0. */}
              {booking.fee > 0 && (
                <div className="text-muted-foreground flex justify-between">
                  <span>Taxa</span>
                  <span>{formatBRL(booking.fee)}</span>
                </div>
              )}
              {booking.discount > 0 && (
                <div className="text-muted-foreground flex justify-between">
                  <span>Desconto</span>
                  <span>−{formatBRL(booking.discount)}</span>
                </div>
              )}
              {booking.surcharge > 0 && (
                <div className="text-muted-foreground flex justify-between">
                  <span>Acréscimo</span>
                  <span>{formatBRL(booking.surcharge)}</span>
                </div>
              )}
              {booking.servicesAmount > 0 && (
                <div className="text-muted-foreground flex justify-between">
                  <span>Serviços</span>
                  <span>{formatBRL(booking.servicesAmount)}</span>
                </div>
              )}
              <div className="border-border text-foreground flex justify-between border-t pt-1.5 font-semibold">
                <span>Total</span>
                <span>{formatBRL(booking.total)}</span>
              </div>
              <div className="text-muted-foreground flex justify-between">
                <span>Recebido</span>
                <span>{formatBRL(booking.amountReceived)}</span>
              </div>
              {booking.status === 'cancelled' || booking.status === 'no_show' ? (
                <div className="text-muted-foreground flex justify-between">
                  <span>Situação</span>
                  <span>Sem cobrança</span>
                </div>
              ) : (
                <div className="text-foreground flex justify-between font-semibold">
                  <span>{booking.balanceDue > 0 ? 'Falta receber' : 'Saldo'}</span>
                  <span className={booking.balanceDue > 0 ? 'text-amber-700' : 'text-emerald-700'}>
                    {booking.balanceDue > 0 ? formatBRL(booking.balanceDue) : 'Pago ✓'}
                  </span>
                </div>
              )}
            </div>
            {booking.paymentDueAt &&
              (booking.status === 'pending' || booking.status === 'quote') && (
                <p className="text-muted-foreground mt-3 text-xs">
                  Prazo de pagamento: {fmtDateTime(booking.paymentDueAt)}
                </p>
              )}
          </Card>

          <Card className="p-6">
            <h2 className="text-foreground font-semibold">Solicitações e observações</h2>
            <div className="mt-3 space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground text-xs font-medium">Solicitações do hóspede</p>
                <p className="text-foreground">{booking.specialRequests || '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs font-medium">
                  Observações internas (nunca visível ao hóspede)
                </p>
                <p className="text-foreground">{booking.internalNotes || '—'}</p>
              </div>
            </div>
          </Card>
        </div>

        <Card className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-foreground font-semibold">Acompanhantes</h2>
              <p className="text-muted-foreground text-sm">
                Responsável + acompanhantes cadastrados nesta reserva.
              </p>
            </div>
            <Link
              href={`/dashboard/reservas/${booking.id}/fnrh`}
              target="_blank"
              rel="noopener noreferrer"
              className="border-input text-foreground hover:bg-muted inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition"
            >
              <Printer className="size-3.5" />
              Imprimir ficha FNRH
            </Link>
          </div>
          <div className="mt-4">
            <BookingCompanionsPanel booking={booking} canEdit={canEdit} />
          </div>
        </Card>

        {canEdit && (
          <Card className="p-6">
            <h2 className="text-foreground font-semibold">Editar reserva</h2>
            <p className="text-muted-foreground text-sm">
              Alterar período ou acomodação revalida disponibilidade automaticamente.
            </p>
            <div className="mt-4">
              <BookingEditPanel booking={booking} canEdit={canEdit} />
            </div>
          </Card>
        )}
      </div>
    </OwnerDashboardShell>
  )
}
