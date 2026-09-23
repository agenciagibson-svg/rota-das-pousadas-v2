'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { cancelBookingChargeAction } from '../../actions'
import { formatBRL, formatFolioDateTime, type FolioCharge } from '../../folio'
import { AddChargeForm } from './add-charge-form'
import { FolioReasonDialog } from './folio-reason-dialog'

/** Consumo da reserva: um lançamento por pedido; cancelado continua visível, riscado. */
export function FolioCharges({
  bookingId,
  charges,
  timeZone,
  canRegister,
  canReverse,
  acceptsCharges,
}: {
  bookingId: string
  charges: FolioCharge[]
  timeZone: string
  canRegister: boolean
  canReverse: boolean
  acceptsCharges: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [target, setTarget] = useState<FolioCharge | null>(null)
  const [error, setError] = useState<string | null>(null)
  const activeTotal = charges.filter((c) => !c.cancelledAt).reduce((sum, c) => sum + c.amount, 0)

  function cancel(reason: string) {
    if (!target) return
    const chargeId = target.id
    setTarget(null)
    setError(null)
    startTransition(async () => {
      const result = await cancelBookingChargeAction({ bookingId, chargeId, reason })
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-foreground font-semibold">Consumo</h3>
        <span className="text-muted-foreground text-sm">{formatBRL(activeTotal)}</span>
      </div>

      {charges.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nenhum consumo lançado.</p>
      ) : (
        <ul className="divide-border divide-y">
          {charges.map((charge) => (
            <li key={charge.id} className="flex items-start justify-between gap-3 py-2 text-sm">
              <div
                className={cn(
                  'min-w-0',
                  charge.cancelledAt && 'text-muted-foreground line-through',
                )}
              >
                <p className="text-foreground truncate">
                  {charge.quantity} × {charge.description}
                </p>
                <p className="text-muted-foreground text-xs">
                  {formatFolioDateTime(charge.createdAt, timeZone)} · {formatBRL(charge.unitPrice)}{' '}
                  cada
                </p>
                {charge.cancelledAt && (
                  <p className="text-muted-foreground text-xs">
                    Cancelado: {charge.cancellationReason}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={cn(
                    'font-medium',
                    charge.cancelledAt && 'text-muted-foreground line-through',
                  )}
                >
                  {formatBRL(charge.amount)}
                </span>
                {canReverse && !charge.cancelledAt && (
                  <Button
                    size="xs"
                    variant="ghost"
                    disabled={isPending}
                    aria-label={`Cancelar ${charge.description}`}
                    onClick={() => setTarget(charge)}
                  >
                    <X className="size-3" />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="text-destructive text-xs font-medium">{error}</p>}

      {canRegister &&
        (acceptsCharges ? (
          <AddChargeForm bookingId={bookingId} />
        ) : (
          <p className="text-muted-foreground text-xs">
            Consumo pode ser lançado depois que a reserva for confirmada.
          </p>
        ))}

      <FolioReasonDialog
        open={target !== null}
        title="Cancelar consumo"
        description="O lançamento continua na conta, riscado, com o motivo. O valor sai do saldo."
        confirmLabel="Cancelar consumo"
        pending={isPending}
        onClose={() => setTarget(null)}
        onConfirm={cancel}
      />
    </div>
  )
}
