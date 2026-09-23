'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Undo2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { reverseManualPaymentAction } from '../../actions'
import { formatBRL, formatFolioDateTime, paymentMethodLabel, type FolioPayment } from '../../folio'
import { FolioReasonDialog } from './folio-reason-dialog'
import { RegisterPaymentForm } from './register-payment-form'

const STATUS_BADGE: Partial<Record<FolioPayment['status'], string>> = {
  pendente: 'Aguardando',
  recusado: 'Recusado',
  estornado: 'Estornado',
}

/** Pagamentos da reserva: os do Mercado Pago chegam sozinhos; os do balcão são registrados aqui. */
export function FolioPayments({
  bookingId,
  payments,
  balanceDue,
  timeZone,
  canRegister,
  canReverse,
  acceptsPayments,
}: {
  bookingId: string
  payments: FolioPayment[]
  balanceDue: number
  timeZone: string
  canRegister: boolean
  canReverse: boolean
  acceptsPayments: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [target, setTarget] = useState<FolioPayment | null>(null)
  const [error, setError] = useState<string | null>(null)

  function reverse(reason: string) {
    if (!target) return
    const paymentId = target.id
    setTarget(null)
    setError(null)
    startTransition(async () => {
      const result = await reverseManualPaymentAction({ bookingId, paymentId, reason })
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-foreground font-semibold">Pagamentos</h3>

      {payments.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nenhum pagamento recebido.</p>
      ) : (
        <ul className="divide-border divide-y">
          {payments.map((payment) => {
            const reversed = payment.status === 'estornado'
            const badge = STATUS_BADGE[payment.status]
            return (
              <li key={payment.id} className="flex items-start justify-between gap-3 py-2 text-sm">
                <div className="min-w-0">
                  <p
                    className={cn(
                      'text-foreground',
                      reversed && 'text-muted-foreground line-through',
                    )}
                  >
                    {paymentMethodLabel(payment)}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {formatFolioDateTime(payment.createdAt, timeZone)}
                    {payment.notes && ` · ${payment.notes}`}
                  </p>
                  {payment.reversalReason && (
                    <p className="text-muted-foreground text-xs">
                      Estorno: {payment.reversalReason}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {badge && (
                    <Badge size="sm" variant={reversed ? 'destructiveSoft' : 'secondary'}>
                      {badge}
                    </Badge>
                  )}
                  <span
                    className={cn('font-medium', reversed && 'text-muted-foreground line-through')}
                  >
                    {formatBRL(payment.amount)}
                  </span>
                  {canReverse && payment.source === 'manual' && payment.status === 'aprovado' && (
                    <Button
                      size="xs"
                      variant="ghost"
                      disabled={isPending}
                      aria-label={`Estornar pagamento de ${formatBRL(payment.amount)}`}
                      onClick={() => setTarget(payment)}
                    >
                      <Undo2 className="size-3" />
                    </Button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {error && <p className="text-destructive text-xs font-medium">{error}</p>}

      {canRegister && acceptsPayments && balanceDue > 0 && (
        <RegisterPaymentForm bookingId={bookingId} balanceDue={balanceDue} />
      )}

      <FolioReasonDialog
        open={target !== null}
        title="Estornar pagamento"
        description="O pagamento continua na lista, riscado, com o motivo. O valor volta para o saldo."
        confirmLabel="Estornar"
        pending={isPending}
        onClose={() => setTarget(null)}
        onConfirm={reverse}
      />
    </div>
  )
}
