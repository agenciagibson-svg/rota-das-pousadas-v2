import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { CalendarCheck, CheckCircle2, Clock3, CreditCard, Users } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { Container } from '@/components/ui/container'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { buttonVariants } from '@/components/ui/button'
import { BOOKING_STATUS } from '@/features/reservas'
import type { Booking } from '@/features/reservas'
import { getMyBookingsReconciled, getCurrentUser, getBookingCheckout } from '@/server/queries'

export const metadata: Metadata = {
  title: 'Pagamento',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

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

/** Pendente com prazo vencido (fora do render, por pureza do React). */
function isDeadlinePassed(booking: Booking): boolean {
  if (booking.status !== 'pending' || !booking.paymentDueAt) return false
  return new Date(booking.paymentDueAt).getTime() <= Date.now()
}

/** Mensagem de status para quando não há (ou não cabe) um botão de pagamento. */
function statusNote(booking: Booking): { title: string; body: string } {
  if (
    booking.status === 'confirmed' ||
    booking.status === 'checked_in' ||
    booking.status === 'checked_out'
  ) {
    return { title: 'Pagamento confirmado', body: 'Sua reserva está garantida.' }
  }
  if (booking.status === 'cancelled' || booking.status === 'no_show') {
    return {
      title: 'Reserva não está mais ativa',
      body: 'Não há pagamento pendente para esta reserva.',
    }
  }
  return {
    title: 'Sem pagamento pendente',
    body: 'Esta reserva não está aguardando pagamento no momento.',
  }
}

export default async function PagamentoReservaPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>
}) {
  const { slug, id } = await params
  const user = await getCurrentUser()
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/pousada/${slug}/reservar/${id}/pagamento`)}`)
  }

  const bookings = await getMyBookingsReconciled()
  const booking = bookings.find((b) => b.id === id && b.pousadaSlug === slug)
  if (!booking) notFound()

  const status = BOOKING_STATUS[booking.status]
  // Pendência com prazo vencido não é "pagamento a combinar": a vaga já foi
  // liberada (0070), então mostra o aviso certo e o caminho para reservar de novo.
  const deadlinePassed = isDeadlinePassed(booking)
  const awaitingPayment = booking.status === 'pending' && booking.balanceDue > 0 && !deadlinePassed

  let initPoint: string | null = null
  if (awaitingPayment) {
    try {
      const preference = await getBookingCheckout(booking.id)
      initPoint = preference.initPoint
    } catch {
      // Pousada ainda não conectou conta de recebimento, ou outra condição
      // momentânea — tratado abaixo como "pagamento a combinar", nunca como
      // erro fatal da página (a reserva já existe e está garantida).
      initPoint = null
    }
  }

  return (
    <div className="bg-background min-h-screen">
      <SiteHeader forceSolid />
      <main className="pt-28 pb-24">
        <Container className="max-w-2xl">
          <Breadcrumb
            items={[
              { label: 'Pousadas', href: '/#pousadas' },
              { label: booking.pousadaName, href: `/pousada/${slug}` },
              { label: 'Pagamento' },
            ]}
          />

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-foreground font-serif text-2xl font-semibold sm:text-3xl">
              Reserva {booking.code}
            </h1>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">{booking.pousadaName}</p>

          <Card radius="3xl" className="shadow-card mt-6 p-6">
            <div className="text-muted-foreground space-y-1.5 text-sm">
              <div className="flex items-center gap-1.5">
                <CalendarCheck className="size-4" />
                {formatDate(booking.checkin)} - {formatDate(booking.checkout)} · {booking.nights}{' '}
                {booking.nights === 1 ? 'noite' : 'noites'}
              </div>
              <div className="flex items-center gap-1.5">
                <Users className="size-4" />
                {booking.guests} {booking.guests === 1 ? 'hóspede' : 'hóspedes'}
              </div>
            </div>

            <div className="border-border mt-5 space-y-1.5 border-t pt-4 text-sm">
              <div className="text-muted-foreground flex justify-between">
                <span>Estadia</span>
                <span>R$ {booking.subtotal}</span>
              </div>
              {booking.fee > 0 && (
                <div className="text-muted-foreground flex justify-between">
                  <span>Taxa de serviço</span>
                  <span>R$ {booking.fee}</span>
                </div>
              )}
              <div className="border-border text-foreground flex justify-between border-t pt-1.5 text-base font-semibold">
                <span>Total</span>
                <span>R$ {booking.total}</span>
              </div>
              {booking.balanceDue !== booking.total && (
                <div className="text-muted-foreground flex justify-between">
                  <span>Saldo a pagar</span>
                  <span>R$ {booking.balanceDue}</span>
                </div>
              )}
            </div>

            <div className="mt-6">
              {initPoint ? (
                <>
                  <a
                    href={initPoint}
                    className={buttonVariants({ size: 'lg', className: 'w-full' })}
                  >
                    <CreditCard className="size-4" />
                    Pagar agora com Mercado Pago
                  </a>
                  <p className="text-muted-foreground mt-2 text-center text-xs">
                    Você será redirecionado para o ambiente seguro do Mercado Pago.
                    {booking.paymentDueAt && (
                      <> Garantido até {formatDateTime(booking.paymentDueAt)}.</>
                    )}
                  </p>
                </>
              ) : deadlinePassed ? (
                <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-900">
                  <div className="flex items-start gap-2">
                    <Clock3 className="mt-0.5 size-4 shrink-0 text-orange-600" />
                    <div>
                      <p className="font-medium">O prazo de pagamento desta reserva terminou.</p>
                      <p className="mt-1">
                        As datas foram liberadas. Se ainda quiser se hospedar, faça uma nova reserva
                        — leva menos de um minuto.
                      </p>
                    </div>
                  </div>
                  <Link
                    href={`/pousada/${slug}/reservar`}
                    className={buttonVariants({ size: 'lg', className: 'mt-4 w-full' })}
                  >
                    Fazer nova reserva
                  </Link>
                </div>
              ) : awaitingPayment ? (
                <div className="border-border bg-secondary/40 flex items-start gap-2 rounded-2xl border p-4 text-sm">
                  <Clock3 className="text-foreground mt-0.5 size-4 shrink-0" />
                  <div className="text-muted-foreground">
                    <p className="text-foreground font-medium">
                      Reserva registrada — pagamento a combinar
                    </p>
                    <p className="mt-1">
                      Esta pousada ainda está configurando o recebimento on-line. Ela entrará em
                      contato para combinar o pagamento
                      {booking.paymentDueAt ? (
                        <> antes de {formatDateTime(booking.paymentDueAt)}.</>
                      ) : (
                        '.'
                      )}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="border-border bg-secondary/40 flex items-start gap-2 rounded-2xl border p-4 text-sm">
                  <CheckCircle2 className="text-foreground mt-0.5 size-4 shrink-0" />
                  <div className="text-muted-foreground">
                    <p className="text-foreground font-medium">{statusNote(booking).title}</p>
                    <p className="mt-1">{statusNote(booking).body}</p>
                  </div>
                </div>
              )}
            </div>
          </Card>

          <p className="text-muted-foreground mt-6 text-center text-sm">
            <Link href="/minhas-reservas" className="text-primary font-semibold hover:underline">
              Ver minhas reservas
            </Link>
          </p>
        </Container>
      </main>
    </div>
  )
}
