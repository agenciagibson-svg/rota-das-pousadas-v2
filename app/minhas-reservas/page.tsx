import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import {
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  Clock3,
  CreditCard,
  ExternalLink,
  MapPin,
  ReceiptText,
  RotateCcw,
  Smartphone,
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
import { guestPrecheckinState, precheckinPath } from '@/features/reservas/precheckin'
import type { BookingStatus } from '@/features/reservas'
import { getCurrentUser, getMyBookingsReconciled } from '@/server/queries'
import {
  PaymentReturnBanner,
  parseMpReturnStatus,
} from '@/features/pagamentos/components/payment-return-banner'
import { isoDateInTimeZone } from '@/lib/dates'
import { isSupabaseConfigured } from '@/lib/env'
import { DemoNotice } from '@/components/demo/demo-notice'
import { demoMyBookings } from '@/features/reservas/demo'
import { DEMO_STAY_ID } from '@/features/estadia/demo'
import { formatBRL, formatDateTime, formatISODate } from '@/lib/format'

export const metadata: Metadata = {
  title: 'Minhas reservas',
  robots: { index: false, follow: false },
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
  // Preview sem banco (sem login possível): reservas fictícias para conhecer a área.
  const demo = !isSupabaseConfigured()
  const [bookings, user] = await Promise.all([
    demo ? demoMyBookings() : getMyBookingsReconciled(),
    getCurrentUser(),
  ])
  // Volta do Mercado Pago (`?pago=<id>&status=...`): destaque do resultado no topo.
  const returned = query.pago ? bookings.find((b) => b.id === query.pago) : undefined
  const mpStatus = parseMpReturnStatus(query.collection_status ?? query.status)
  // "Hoje" no fuso de Brasília (UTC vira o dia às 21h).
  const today = isoDateInTimeZone(new Date())
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
      <main id="conteudo" tabIndex={-1} className="pt-32 pb-24">
        <Container className="max-w-5xl">
          <h1 className="text-h1 text-foreground">Minhas reservas</h1>
          <p className="text-muted-foreground mt-2 text-base">
            Acompanhe suas estadias, valores e próximas ações.
          </p>

          {demo && (
            <DemoNotice className="mt-6">
              Este ambiente de teste não tem banco conectado. Com a sua conta, aqui aparecem as suas
              reservas de verdade.
            </DemoNotice>
          )}

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
                <Link href="/#pousadas" className={buttonVariants({ size: 'pill' })}>
                  Ver pousadas
                </Link>
              }
            />
          ) : (
            <div className="mt-8 space-y-6">
              <div className="grid gap-3 sm:grid-cols-3">
                <Card radius="3xl" border={false} className="p-5">
                  <div className="text-muted-foreground flex items-center gap-2 text-sm">
                    <CalendarCheck className="text-primary size-4" />
                    Próximas estadias
                  </div>
                  <div className="text-display-l text-foreground mt-2 font-light tabular-nums">
                    {upcomingBookings.length}
                  </div>
                </Card>
                <Card radius="3xl" border={false} className="p-5">
                  <div className="text-muted-foreground flex items-center gap-2 text-sm">
                    <Clock3 className="text-primary size-4" />
                    Aguardando pagamento
                  </div>
                  <div className="text-display-l text-foreground mt-2 font-light tabular-nums">
                    {pendingBookings.length}
                  </div>
                </Card>
                <Card radius="3xl" border={false} className="p-5">
                  <div className="text-muted-foreground flex items-center gap-2 text-sm">
                    <ReceiptText className="text-primary size-4" />
                    Total ativo
                  </div>
                  <div className="text-display-l text-foreground mt-2 font-light tabular-nums">
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
                  // Pré-check-in (0088). No modo demonstração não há ficha para abrir.
                  const precheckin = demo ? null : guestPrecheckinState(booking, today)

                  return (
                    <Card
                      key={booking.id}
                      radius="3xl"
                      border={false}
                      className="overflow-hidden p-0"
                    >
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
                                <h2 className="text-h3 text-foreground">{booking.pousadaName}</h2>
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
                                  {formatISODate(booking.checkin)} –{' '}
                                  {formatISODate(booking.checkout)} · {booking.nights}{' '}
                                  {booking.nights === 1 ? 'noite' : 'noites'}
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
                              <div className="text-foreground text-2xl font-semibold tabular-nums">
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
                            <div className="border-ipe/50 bg-ipe/15 text-foreground mt-4 flex items-start gap-2 rounded-2xl border p-3 text-sm">
                              <Clock3 className="text-foreground mt-0.5 size-4 shrink-0" />
                              <span>
                                O prazo de pagamento terminou e as datas foram liberadas. Se ainda
                                quiser ir, faça uma nova reserva.
                              </span>
                            </div>
                          )}

                          {awaitingApproval && (
                            <div className="border-border bg-secondary text-foreground mt-4 flex items-start gap-2 rounded-2xl border p-3 text-sm">
                              <Clock3 className="text-foreground mt-0.5 size-4 shrink-0" />
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
                              className={buttonVariants({ variant: 'outline', size: 'pill-sm' })}
                            >
                              <ExternalLink className="size-3.5" />
                              Ver pousada
                            </Link>
                            {payable && (
                              <Link
                                href={`/pousada/${booking.pousadaSlug}/reservar/${booking.id}/pagamento`}
                                className={buttonVariants({ variant: 'accent', size: 'pill-sm' })}
                              >
                                <CreditCard className="size-3.5" />
                                Pagar agora
                              </Link>
                            )}
                            {(booking.status === 'confirmed' ||
                              booking.status === 'checked_in' ||
                              booking.status === 'checked_out') &&
                              (!demo || booking.id === DEMO_STAY_ID) && (
                                <Link
                                  href={`/estadia/${booking.id}`}
                                  className={buttonVariants({ size: 'pill-sm' })}
                                >
                                  <Smartphone className="size-3.5" />
                                  App da estadia
                                </Link>
                              )}
                            {precheckin === 'todo' && (
                              <Link
                                href={precheckinPath(booking.id)}
                                className={buttonVariants({ variant: 'accent', size: 'pill' })}
                              >
                                <ClipboardList className="size-3.5" />
                                Preencher ficha
                              </Link>
                            )}
                            {precheckin === 'done' &&
                              (booking.status === 'checked_in' ? (
                                <Badge variant="primarySoft" size="lg">
                                  <CheckCircle2 className="size-3.5" />
                                  Ficha enviada
                                </Badge>
                              ) : (
                                <Link
                                  href={precheckinPath(booking.id)}
                                  className={buttonVariants({
                                    variant: 'secondary',
                                    size: 'pill',
                                  })}
                                >
                                  <CheckCircle2 className="size-3.5" />
                                  Ficha enviada
                                </Link>
                              ))}
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
                                className={buttonVariants({
                                  variant: 'secondary',
                                  size: 'pill-sm',
                                })}
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
