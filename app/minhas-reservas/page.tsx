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
import { getMyBookings } from '@/server/queries'

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

function isActiveStatus(status: BookingStatus) {
  return !['cancelled', 'no_show'].includes(status)
}

export default async function MyBookingsPage() {
  const bookings = await getMyBookings()
  const today = new Date().toISOString().slice(0, 10)
  const activeBookings = bookings.filter((booking) => isActiveStatus(booking.status))
  const pendingBookings = bookings.filter((booking) => booking.status === 'pending')
  const upcomingBookings = activeBookings.filter((booking) => booking.checkout >= today)
  const activeTotal = activeBookings.reduce((sum, booking) => sum + booking.total, 0)

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader forceSolid />
      <main className="pb-24 pt-28">
        <Container className="max-w-5xl">
          <h1 className="font-serif text-3xl font-semibold text-foreground sm:text-4xl">
            Minhas reservas
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Acompanhe suas estadias, valores e próximas ações.
          </p>

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
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CalendarCheck className="size-4 text-primary" />
                    Próximas estadias
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-foreground">
                    {upcomingBookings.length}
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock3 className="size-4 text-primary" />
                    Aguardando pagamento
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-foreground">
                    {pendingBookings.length}
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <ReceiptText className="size-4 text-primary" />
                    Total ativo
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-foreground">
                    R$ {activeTotal}
                  </div>
                </Card>
              </div>

              <div className="flex flex-col gap-4">
                {bookings.map((booking) => {
                  const status = BOOKING_STATUS[booking.status]
                  const canCancel = ['quote', 'pending'].includes(booking.status)

                  return (
                    <Card key={booking.id} className="overflow-hidden p-0">
                      <div className="grid md:grid-cols-[180px_1fr]">
                        <Link
                          href={`/pousada/${booking.pousadaSlug}`}
                          className="relative h-40 overflow-hidden bg-secondary md:h-full"
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
                                <h2 className="font-serif text-xl font-semibold text-foreground">
                                  {booking.pousadaName}
                                </h2>
                                <Badge variant={status.variant} size="sm">
                                  {status.label}
                                </Badge>
                              </div>

                              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
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
                                  {booking.guests}{' '}
                                  {booking.guests === 1 ? 'hóspede' : 'hóspedes'}
                                </span>
                              </div>

                              <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
                                <ReceiptText className="size-3.5" />
                                Código {booking.code}
                              </div>
                            </div>

                            <div className="shrink-0 text-left lg:text-right">
                              <div className="text-2xl font-semibold text-foreground">
                                R$ {booking.total}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                R$ {booking.subtotal} estadia + R$ {booking.fee} taxa
                              </div>
                            </div>
                          </div>

                          {booking.status === 'pending' && (
                            <div className="mt-4 flex items-start gap-2 rounded-2xl bg-gold/10 p-3 text-sm text-muted-foreground">
                              <CreditCard className="mt-0.5 size-4 shrink-0 text-foreground" />
                              <span>
                                Sua reserva foi criada e fica garantida até{' '}
                                <strong className="font-semibold text-foreground">
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
                            <div className="mt-4 rounded-2xl bg-secondary p-3 text-sm text-muted-foreground">
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
                            {canCancel && <CancelBookingButton bookingId={booking.id} />}
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
