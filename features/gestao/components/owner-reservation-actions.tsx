'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Flag, XCircle, Clock3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import type { BookingStatus } from '@/features/reservas/types'
import { updateReservationStatusAction, expireOwnerPendingBookingAction } from '../actions'

type ActionItem = {
  label: string
  status: BookingStatus
  icon: typeof Check
  variant?: 'default' | 'secondary' | 'destructive'
  requiresReason?: boolean
}

/** [Ciclo 4] Só transições pré-check-in — check-in/checkout aparecem desabilitados, nunca simulados (RB seção 16). */
function getActions(status: BookingStatus): ActionItem[] {
  if (status === 'quote' || status === 'pending') {
    return [
      { label: 'Confirmar', status: 'confirmed', icon: Check },
      { label: 'Cancelar', status: 'cancelled', icon: XCircle, variant: 'destructive', requiresReason: true },
    ]
  }
  if (status === 'confirmed') {
    return [
      { label: 'Cancelar', status: 'cancelled', icon: XCircle, variant: 'destructive', requiresReason: true },
      { label: 'Marcar no-show', status: 'no_show', icon: Flag, variant: 'secondary', requiresReason: true },
    ]
  }
  return []
}

export function OwnerReservationActions({
  bookingId,
  currentStatus,
  paymentDueAt,
}: {
  bookingId: string
  currentStatus: BookingStatus
  paymentDueAt?: string | null
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [reasonTarget, setReasonTarget] = useState<ActionItem | null>(null)
  const [reason, setReason] = useState('')
  const actions = getActions(currentStatus)
  const isOverduePending = currentStatus === 'pending' && !!paymentDueAt && paymentDueAt < new Date().toISOString()

  function run(promise: Promise<{ ok: boolean; error?: string }>) {
    setError(null)
    startTransition(async () => {
      const result = await promise
      if (!result.ok) {
        setError(result.error ?? 'Erro inesperado.')
        return
      }
      router.refresh()
    })
  }

  function trigger(action: ActionItem) {
    if (action.requiresReason) {
      setReasonTarget(action)
      return
    }
    run(updateReservationStatusAction({ bookingId, status: action.status }))
  }

  function confirmReason() {
    if (!reasonTarget) return
    const action = reasonTarget
    setReasonTarget(null)
    run(updateReservationStatusAction({ bookingId, status: action.status, reason }))
    setReason('')
  }

  return (
    <div className="flex min-w-36 flex-col items-start gap-1.5">
      <div className="flex flex-wrap gap-1.5">
        {actions.map((action) => {
          const Icon = action.icon
          return (
            <Button
              key={action.status}
              type="button"
              size="xs"
              variant={action.variant ?? 'default'}
              disabled={isPending}
              onClick={() => trigger(action)}
            >
              <Icon className="size-3" />
              {action.label}
            </Button>
          )
        })}
        {currentStatus === 'confirmed' && (
          <Button type="button" size="xs" variant="ghost" disabled title="Disponível no Ciclo 6">
            <Clock3 className="size-3" />
            Check-in
          </Button>
        )}
      </div>
      {isOverduePending && (
        <Button
          type="button"
          size="xs"
          variant="ghost"
          disabled={isPending}
          onClick={() => run(expireOwnerPendingBookingAction({ bookingId }))}
        >
          <Clock3 className="size-3" />
          Expirar (prazo vencido)
        </Button>
      )}
      {actions.length === 0 && !isOverduePending && <span className="text-xs text-muted-foreground">Sem ações</span>}
      {error && <span className="text-xs font-medium text-destructive">{error}</span>}

      <Dialog
        open={reasonTarget !== null}
        onClose={() => setReasonTarget(null)}
        title={reasonTarget?.label ?? ''}
        description="Descreva o motivo — fica registrado na auditoria da reserva."
        footer={
          <>
            <Button variant="ghost" onClick={() => setReasonTarget(null)}>
              Voltar
            </Button>
            <Button
              variant={reasonTarget?.variant === 'destructive' ? 'destructive' : 'default'}
              onClick={confirmReason}
              disabled={reason.trim().length < 3}
            >
              Confirmar
            </Button>
          </>
        }
      >
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="Motivo (obrigatório)"
          className="w-full resize-none rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm text-foreground outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/20"
        />
      </Dialog>
    </div>
  )
}
