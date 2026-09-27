import Link from 'next/link'
import { CheckCircle2, Clock3, Loader2, XCircle } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import type { Booking } from '@/features/reservas'
import { PaymentReturnRefresher } from './payment-return-refresher'
import { paymentReturnVariant, type MpReturnStatus } from '../payment-return'

export { parseMpReturnStatus } from '../payment-return'

/**
 * Resposta clara logo que o hóspede volta do Mercado Pago: pago e confirmado,
 * confirmando (recarrega sozinho), em análise ou não concluído.
 */
export function PaymentReturnBanner({
  booking,
  mpStatus,
  guestEmail,
}: {
  booking: Booking
  mpStatus: MpReturnStatus
  guestEmail?: string | null
}) {
  const variant = paymentReturnVariant(booking, mpStatus)
  const payPath = `/pousada/${booking.pousadaSlug}/reservar/${booking.id}/pagamento`

  if (variant === 'confirmed') {
    return (
      <div
        role="status"
        className="mt-8 rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-950"
      >
        <div className="flex items-start gap-4">
          <CheckCircle2 className="size-10 shrink-0 text-emerald-600" />
          <div>
            <p className="font-serif text-2xl font-semibold">Pagamento aprovado!</p>
            <p className="mt-1 text-base">
              Sua reserva <strong>{booking.code}</strong> em {booking.pousadaName} está{' '}
              <strong>confirmada</strong>.
            </p>
            <p className="mt-2 text-sm text-emerald-900/80">
              Enviamos o comprovante para{' '}
              {guestEmail ? <strong>{guestEmail}</strong> : 'o seu e-mail'}. Confira também a caixa
              de spam.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (variant === 'confirming') {
    return (
      <div
        role="status"
        className="mt-8 rounded-3xl border border-sky-200 bg-sky-50 p-6 text-sky-950"
      >
        <PaymentReturnRefresher />
        <div className="flex items-start gap-4">
          <Loader2 className="size-10 shrink-0 animate-spin text-sky-600" />
          <div>
            <p className="font-serif text-2xl font-semibold">
              Pagamento aprovado — confirmando sua reserva…
            </p>
            <p className="mt-1 text-base">
              O Mercado Pago aprovou o pagamento da reserva <strong>{booking.code}</strong>. Estamos
              registrando a confirmação; esta página atualiza sozinha em alguns segundos.
            </p>
            <p className="mt-2 text-sm text-sky-900/80">Não precisa pagar de novo.</p>
          </div>
        </div>
      </div>
    )
  }

  if (variant === 'analysis') {
    return (
      <div
        role="status"
        className="mt-8 rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-950"
      >
        <PaymentReturnRefresher />
        <div className="flex items-start gap-4">
          <Clock3 className="size-10 shrink-0 text-amber-600" />
          <div>
            <p className="font-serif text-2xl font-semibold">Pagamento em análise</p>
            <p className="mt-1 text-base">
              O Mercado Pago ainda está analisando o pagamento da reserva{' '}
              <strong>{booking.code}</strong>. Assim que for aprovado, a reserva é confirmada e você
              recebe um e-mail.
            </p>
            <p className="mt-2 text-sm text-amber-900/80">Não precisa pagar de novo.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      role="alert"
      className="mt-8 rounded-3xl border border-orange-200 bg-orange-50 p-6 text-orange-950"
    >
      <div className="flex items-start gap-4">
        <XCircle className="size-10 shrink-0 text-orange-600" />
        <div>
          <p className="font-serif text-2xl font-semibold">O pagamento não foi concluído</p>
          <p className="mt-1 text-base">
            Nenhum valor foi cobrado pela reserva <strong>{booking.code}</strong>. Ela continua
            garantida até o fim do prazo — você pode tentar de novo.
          </p>
          {booking.status === 'pending' && (
            <Link href={payPath} className={buttonVariants({ className: 'mt-4' })}>
              Tentar pagar de novo
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
