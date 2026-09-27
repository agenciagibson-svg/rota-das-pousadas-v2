import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import {
  CalendarCheck,
  Clock3,
  CreditCard,
  ExternalLink,
  MapPin,
  ReceiptText,
  RotateCcw,
  Users,
} from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { Container } from '@/components/ui/container'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { buttonVariants } from '@/components/ui/button'
import { BOOKING_STATUS, CancelBookingButton } from '@/features/reservas'
import type { BookingStatus } from '@/features/reservas'
import { getCurrentUser, getMyBookingsReconciled } from '@/server/queries'
import {
  PaymentReturnBanner,
  parseMpReturnStatus,
} from '@/features/pagamentos/components/payment-return-banner'
import { formatBRL } from '@/lib/format'

export const metadata: Metadata = {
  title: 'Minhas reservas',
  robots: { index: false, follow: false },
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

/** Pendente com prazo vencido: a vaga já foi liberada (0070). */
function isExpiredPending(booking: { status: BookingStatus; paymentDueAt: string | null }) {
  return (
    booking.status === 'pending' &&
    Boolean(booking.paymentDueAt) &&
    new Date(booking.paymentDueAt as string).getTime() <= Date.now()
  )
}

function isActiveStatus(status: BookingStatus) {
  return !['cancelled', 'no_show'].includes(status)
}

export default async function MyBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ pago?: string; status?: string; collection_status?: string }>
}) {
  const query = await searchParams
  const [bookings, user] = await Promise.all([getMyBookingsReconciled(), getCurrentUser()])
  // Volta do Mercado Pago (`?pago=<id>&status=...`): destaque do resultado no topo.
  const returned = query.pago ? bookings.find((b) => b.id === query.pago) : undefined
  const mpStatus = parseMpReturnStatus(query.collection_status ?? query.status)
  const today = new Date().toISOString().slice(0, 10)
  const activeBookings = bookings.filter((booking) => isActiveStatus(booking.status))
  const pendingBookings = bookings.filter(
    (booking) =>
      booking.status === 'pending' && !isExpiredPending(booking) && !booking.awaitingPixApproval,
  )
  const upcomingBookings = activeBookings.filter((booking) => booking.checkout >= today)
  const activeTotal = activeBookings.reduce((sum, booking) => sum + booking.total, 0)

  return (
    <div className="bg-background min-h-screen">
      <SiteHeader forceSolid />
      <main className="pt-28 pb-24">
        <Container className="max-w-5xl">
          <h1 className="text-foreground font-serif text-3xl font-semibold sm:text-4xl">
            Minhas reservas
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Acompanhe suas estadias, valores e próximas ações.
          </p>

          {returned && (
            <PaymentReturnBanner booking={returned} mpStatus={mpStatus} guestEmail={user?.email} />
          )}

          {bookings.length === 0 ? (
            <EmptyState
              className="mt-10"
              icon={CalendarCheck}
              title="Você ainda não tem reservas"
              description="Explore nossa curadoria de refúgios e comece a planejar sua próxima rota."
              action={
                <Link href="/#pousadas" className={buttonVariants()}>
                  Ver pousadas
                </Link>
              }
            />
          ) : (
            <div className="mt-8 space-y-6">
              <div className="grid gap-3 sm:grid-cols-3">
                <Card className="p-4">
                  <div className="text-muted-foreground flex items-center gap-2 text-sm">
                    <CalendarCheck className="text-primary size-4" />
                    Próximas estadias
                  </div>
                  <div className="text-foreground mt-2 text-2xl font-semibold">
                    {upcomingBookings.length}
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="text-muted-foreground flex items-center gap-2 text-sm">
                    <Clock3 className="text-primary size-4" />
                    Aguardando pagamento
                  </div>
                  <div className="text-foreground mt-2 text-2xl font-semibold">
                    {pendingBookings.length}
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="text-muted-foreground flex items-center gap-2 text-sm">
                    <ReceiptText className="text-primary size-4" />
                    Total ativo
                  </div>
                  <div className="text-foreground mt-2 text-2xl font-semibold">
                    {formatBRL(activeTotal)}
                  </div>
                </Card>
              </div>

              <div className="flex flex-col gap-4">
                {bookings.map((booking) => {
                  const status = BOOKING_STATUS[booking.status]
                  const canCancel = ['quote', 'pending'].includes(booking.status)
                  const expired = isExpiredPending(booking)
                  const awaitingApproval =
                    Boolean(booking.awaitingPixApproval) && booking.status === 'pending'
                  const payable = booking.status === 'pending' && !expired && !awaitingApproval
                  // "Reservar novamente" com as mesmas datas só faz sentido quando
                  // esta reserva não segura mais o quarto; senão cairia em datas ocupadas.
                  const canRebook =
                    expired || !isActiveStatus(booking.status) || booking.status === 'checked_out'

                  return (
                    <Card key={booking.id} className="overflow-hidden p-0">
                      <div className="grid md:grid-cols-[180px_1fr]">
                        <Link
                          href={`/pousada/${booking.pousadaSlug}`}
                          className="bg-secondary relative h-40 overflow-hidden md:h-full"
                        >
                          <Image
                            src={booking.pousadaImage || '/placeholder.svg'}
                            alt={booking.pousadaName}
                            fill
                            sizes="220px"
                            className="object-cover"
                          />
                        </Link>

                        <div className="p-5">
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h2 className="text-foreground font-serif text-xl font-semibold">
                                  {booking.pousadaName}
                                </h2>
                                <Badge variant={status.variant} size="sm">
                                  {awaitingApproval ? 'Aguardando aprovação' : status.label}
                                </Badge>
                              </div>

                              <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                                <span className="inline-flex items-center gap-1.5">
                                  <MapPin className="size-3.5" />
                                  {booking.city}, {booking.state}
                                </span>
                                <span className="inline-flex items-center gap-1.5">
                                  <CalendarCheck className="size-3.5" />
                                  {formatDate(booking.checkin)} - {formatDate(booking.checkout)} ·{' '}
                                  {booking.nights} {booking.nights === 1 ? 'noite' : 'noites'}
                                </span>
                                <span className="inline-flex items-center gap-1.5">
                                  <Users className="size-3.5" />
                                  {booking.guests} {booking.guests === 1 ? 'hóspede' : 'hóspedes'}
                                </span>
                              </div>

                              <div className="bg-secondary text-muted-foreground mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium">
                                <ReceiptText className="size-3.5" />
                                Código {booking.code}
                              </div>
                            </div>

                            <div className="shrink-0 text-left lg:text-right">
                              <div className="text-foreground text-2xl font-semibold">
                                {formatBRL(booking.total)}
                              </div>
                              <div className="text-muted-foreground text-xs">
                                {booking.fee > 0
                                  ? `${formatBRL(booking.subtotal)} estadia + ${formatBRL(booking.fee)} taxa`
                                  : `${formatBRL(booking.subtotal)} estadia`}
                              </div>
                            </div>
                          </div>

                          {expired && (
                            <div className="mt-4 flex items-start gap-2 rounded-2xl border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900">
                              <Clock3 className="mt-0.5 size-4 shrink-0 text-orange-600" />
                              <span>
                                O prazo de pagamento terminou e as datas foram liberadas. Se ainda
                                quiser ir, faça uma nova reserva.
                              </span>
                            </div>
                          )}

                          {awaitingApproval && (
                            <div className="mt-4 flex items-start gap-2 rounded-2xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950">
                              <Clock3 className="mt-0.5 size-4 shrink-0 text-sky-600" />
                              <span>
                                Comprovante do Pix enviado. A pousada está conferindo o pagamento e
                                você recebe um e-mail quando a reserva for confirmada. Suas datas
                                continuam guardadas.
                              </span>
                            </div>
                          )}

                          {payable && (
                            <div className="bg-gold/10 text-muted-foreground mt-4 flex items-start gap-2 rounded-2xl p-3 text-sm">
                              <CreditCard className="text-foreground mt-0.5 size-4 shrink-0" />
                              <span>
                                Sua reserva foi criada e fica garantida até{' '}
                                <strong className="text-foreground font-semibold">
                                  {booking.paymentDueAt
                                    ? formatDateTime(booking.paymentDueAt)
                                    : 'o fim do prazo de pagamento'}
                                </strong>
                                . Se o pagamento não for identificado até esse prazo, a pousada
                                poderá cancelá-la.
                              </span>
                            </div>
                          )}

                          {booking.status === 'cancelled' && booking.cancellationReason && (
                            <div className="bg-secondary text-muted-foreground mt-4 rounded-2xl p-3 text-sm">
                              Reserva cancelada — {booking.cancellationReason}. Você pode reservar
                              novamente se ainda houver disponibilidade.
                            </div>
                          )}

                          <div className="mt-5 flex flex-wrap gap-2">
                            <Link
                              href={`/pousada/${booking.pousadaSlug}`}
                              className={buttonVariants({ variant: 'outline', size: 'sm' })}
                            >
                              <ExternalLink className="size-3.5" />
                              Ver pousada
                            </Link>
                            {payable && (
                              <Link
                                href={`/pousada/${booking.pousadaSlug}/reservar/${booking.id}/pagamento`}
                                className={buttonVariants({ size: 'sm' })}
                              >
                                <CreditCard className="size-3.5" />
                                Pagar agora
                              </Link>
                            )}
                            {canRebook && (
                              <Link
                                href={{
                                  pathname: `/pousada/${booking.pousadaSlug}/reservar`,
                                  query: {
                                    checkin: booking.checkin,
                                    checkout: booking.checkout,
                                    guests: booking.guests,
                                  },
                                }}
                                className={buttonVariants({ variant: 'secondary', size: 'sm' })}
                              >
                                <RotateCcw className="size-3.5" />
                                Reservar novamente
                              </Link>
                            )}
                            {canCancel && !awaitingApproval && (
                              <CancelBookingButton bookingId={booking.id} />
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>
            </div>
          )}
        </Container>
      </main>
      <SiteFooter />
    </div>
  )
}
