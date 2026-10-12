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
        className="border-success/30 bg-success/10 text-foreground mt-8 rounded-3xl border p-6"
      >
        <div className="flex items-start gap-4">
          <CheckCircle2 className="text-success size-10 shrink-0" />
          <div>
            <p className="text-h2">Pagamento aprovado!</p>
            <p className="mt-1 text-base">
              Sua reserva <strong>{booking.code}</strong> em {booking.pousadaName} está{' '}
              <strong>confirmada</strong>.
            </p>
            <p className="text-muted-foreground mt-2 text-sm">
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
        className="border-border bg-secondary text-foreground mt-8 rounded-3xl border p-6"
      >
        <PaymentReturnRefresher />
        <div className="flex items-start gap-4">
          <Loader2 className="text-foreground size-10 shrink-0 animate-spin" />
          <div>
            <p className="text-h2">Pagamento aprovado — confirmando sua reserva…</p>
            <p className="mt-1 text-base">
              O Mercado Pago aprovou o pagamento da reserva <strong>{booking.code}</strong>. Estamos
              registrando a confirmação; esta página atualiza sozinha em alguns segundos.
            </p>
            <p className="text-muted-foreground mt-2 text-sm">Não precisa pagar de novo.</p>
          </div>
        </div>
      </div>
    )
  }

  if (variant === 'analysis') {
    return (
      <div
        role="status"
        className="border-ipe/50 bg-ipe/15 text-foreground mt-8 rounded-3xl border p-6"
      >
        <PaymentReturnRefresher />
        <div className="flex items-start gap-4">
          <Clock3 className="text-foreground size-10 shrink-0" />
          <div>
            <p className="text-h2">Pagamento em análise</p>
            <p className="mt-1 text-base">
              O Mercado Pago ainda está analisando o pagamento da reserva{' '}
              <strong>{booking.code}</strong>. Assim que for aprovado, a reserva é confirmada e você
              recebe um e-mail.
            </p>
            <p className="text-muted-foreground mt-2 text-sm">Não precisa pagar de novo.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      role="alert"
      className="border-ipe/50 bg-ipe/15 text-foreground mt-8 rounded-3xl border p-6"
    >
      <div className="flex items-start gap-4">
        <XCircle className="text-foreground size-10 shrink-0" />
        <div>
          <p className="text-h2">O pagamento não foi concluído</p>
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
