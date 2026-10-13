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
import { getMyBookingsReconciled, getCurrentUser, getCanPayOnline } from '@/server/queries'
import {
  getPixPaymentForBooking,
  type PixPayment,
} from '@/features/pagamentos/services/pix.service'
import { PixPaymentPanel } from '@/features/pagamentos/components/pix-payment-panel'
import { formatBRL, formatDateTime, formatISODate } from '@/lib/format'

export const metadata: Metadata = {
  title: 'Pagamento',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

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
  searchParams,
}: {
  params: Promise<{ slug: string; id: string }>
  searchParams: Promise<{ erro?: string }>
}) {
  const { slug, id } = await params
  const { erro } = await searchParams
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

  // O link do Mercado Pago NÃO é gerado aqui: o botão aponta para a rota
  // `/pagar`, que confere login + dono da reserva e só então cria o checkout.
  let payOnline = false
  if (awaitingPayment) {
    try {
      payOnline = await getCanPayOnline(booking.id)
    } catch {
      // Falha momentânea: tratado como "a combinar", nunca erro fatal da página.
      payOnline = false
    }
  }
  const payHref = `/pousada/${slug}/reservar/${booking.id}/pagar`

  // Pix direto na conta da pousada (0075): QR Code + copia e cola + comprovante.
  let pix: PixPayment | null = null
  if (booking.status === 'pending') {
    try {
      pix = await getPixPaymentForBooking({
        id: booking.id,
        code: booking.code,
        balanceDue: booking.balanceDue,
      })
    } catch {
      pix = null
    }
  }
  const awaitingApproval = booking.status === 'pending' && pix?.lastProof?.status === 'submitted'
  const showPix = Boolean(pix && awaitingPayment && pix.available)

  return (
    <div className="bg-background min-h-screen">
      <SiteHeader forceSolid />
      <main id="conteudo" tabIndex={-1} className="pt-28 pb-24">
        <Container className="max-w-2xl">
          <Breadcrumb
            items={[
              { label: 'Pousadas', href: '/#pousadas' },
              { label: booking.pousadaName, href: `/pousada/${slug}` },
              { label: 'Pagamento' },
            ]}
          />

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-h1 text-foreground">Reserva {booking.code}</h1>
            <Badge variant={awaitingApproval ? 'goldSoft' : status.variant}>
              {awaitingApproval ? 'Aguardando aprovação' : status.label}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">{booking.pousadaName}</p>

          <Card radius="3xl" border={false} className="shadow-floating mt-6 p-6 lg:p-8">
            <div className="text-muted-foreground space-y-1.5 text-sm">
              <div className="flex items-center gap-1.5">
                <CalendarCheck className="size-4" />
                {formatISODate(booking.checkin)} – {formatISODate(booking.checkout)} ·{' '}
                {booking.nights} {booking.nights === 1 ? 'noite' : 'noites'}
              </div>
              <div className="flex items-center gap-1.5">
                <Users className="size-4" />
                {booking.guests} {booking.guests === 1 ? 'hóspede' : 'hóspedes'}
              </div>
            </div>

            <div className="border-border mt-5 space-y-1.5 border-t pt-4 text-sm">
              <div className="text-muted-foreground flex justify-between tabular-nums">
                <span>Estadia</span>
                <span>{formatBRL(booking.subtotal)}</span>
              </div>
              {booking.fee > 0 && (
                <div className="text-muted-foreground flex justify-between">
                  <span>Taxa de serviço</span>
                  <span>{formatBRL(booking.fee)}</span>
                </div>
              )}
              <div className="border-border text-foreground flex justify-between border-t pt-1.5 text-base font-semibold">
                <span>Total</span>
                <span>{formatBRL(booking.total)}</span>
              </div>
              {booking.balanceDue !== booking.total && (
                <div className="text-muted-foreground flex justify-between">
                  <span>Saldo a pagar</span>
                  <span>{formatBRL(booking.balanceDue)}</span>
                </div>
              )}
            </div>

            <div className="mt-6">
              {erro === 'pagamento' && awaitingPayment && (
                <div
                  role="alert"
                  className="border-ipe/50 bg-ipe/15 text-foreground mb-4 rounded-2xl border p-4 text-sm"
                >
                  Não conseguimos abrir o pagamento agora. Tente de novo em instantes.
                </div>
              )}
              {awaitingApproval && pix ? (
                <PixPaymentPanel
                  bookingId={booking.id}
                  bookingCode={booking.code}
                  pix={pix}
                  canPay={awaitingPayment}
                />
              ) : awaitingPayment && (showPix || payOnline) ? (
                <div className="space-y-4">
                  {showPix && pix && (
                    <PixPaymentPanel
                      bookingId={booking.id}
                      bookingCode={booking.code}
                      pix={pix}
                      canPay={awaitingPayment}
                    />
                  )}
                  {payOnline && (
                    <div>
                      {showPix && (
                        <p className="text-muted-foreground mb-2 text-center text-sm font-medium">
                          ou pague com cartão
                        </p>
                      )}
                      <a
                        href={payHref}
                        rel="nofollow"
                        className={buttonVariants({
                          size: 'pill-lg',
                          variant: showPix ? 'outline' : 'accent',
                          className: 'w-full',
                        })}
                      >
                        <CreditCard className="size-4" />
                        {showPix
                          ? 'Cartão de crédito (Mercado Pago)'
                          : 'Pagar agora com Mercado Pago'}
                      </a>
                      <p className="text-muted-foreground mt-2 text-center text-sm">
                        Você será redirecionado para o ambiente seguro do Mercado Pago.
                      </p>
                    </div>
                  )}
                  {booking.paymentDueAt && (
                    <p className="text-muted-foreground text-center text-sm">
                      Suas datas ficam guardadas até {formatDateTime(booking.paymentDueAt)}.
                    </p>
                  )}
                </div>
              ) : deadlinePassed ? (
                <div className="border-ipe/50 bg-ipe/15 text-foreground rounded-2xl border p-4 text-sm">
                  <div className="flex items-start gap-2">
                    <Clock3 className="mt-0.5 size-4 shrink-0" />
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
                    className={buttonVariants({ size: 'pill', className: 'mt-4 w-full' })}
                  >
                    Fazer nova reserva
                  </Link>
                </div>
              ) : awaitingPayment ? (
                <div className="bg-secondary flex items-start gap-2 rounded-2xl p-4 text-sm">
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
                <div className="bg-secondary flex items-start gap-2 rounded-2xl p-4 text-sm">
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
            <Link
              href="/minhas-reservas"
              className="text-foreground font-semibold underline-offset-4 hover:underline"
            >
              Ver minhas reservas
            </Link>
          </p>
        </Container>
      </main>
    </div>
  )
}
