'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Flag, LogIn, LogOut, XCircle, Clock3 } from 'lucide-react'
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
  disabled?: boolean
  title?: string
}

/**
 * Espelha as transições de `set_booking_status` (0034 + 0048). A regra de data
 * do check-in é do banco; aqui só evitamos oferecer o botão antes da entrada
 * (`checkinISO`), para a recepção não receber um erro evitável.
 */
function getActions(status: BookingStatus, checkinISO?: string | null): ActionItem[] {
  if (status === 'quote' || status === 'pending') {
    return [
      { label: 'Confirmar', status: 'confirmed', icon: Check },
      { label: 'Cancelar', status: 'cancelled', icon: XCircle, variant: 'destructive', requiresReason: true },
    ]
  }
  if (status === 'confirmed') {
    const todayISO = localISODate(new Date())
    const canCheckInToday = !checkinISO || checkinISO <= todayISO
    return [
      {
        label: 'Check-in',
        status: 'checked_in',
        icon: LogIn,
        disabled: !canCheckInToday,
        title: canCheckInToday || !checkinISO ? undefined : `Check-in a partir de ${fmtDate(checkinISO)}`,
      },
      { label: 'Cancelar', status: 'cancelled', icon: XCircle, variant: 'destructive', requiresReason: true },
      { label: 'Marcar no-show', status: 'no_show', icon: Flag, variant: 'secondary', requiresReason: true },
    ]
  }
  if (status === 'checked_in') {
    return [{ label: 'Check-out', status: 'checked_out', icon: LogOut }]
  }
  return []
}

/** Data local do navegador em YYYY-MM-DD (só para esconder o botão cedo demais; a regra real é a RPC). */
function localISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function OwnerReservationActions({
  bookingId,
  currentStatus,
  paymentDueAt,
  checkin,
}: {
  bookingId: string
  currentStatus: BookingStatus
  paymentDueAt?: string | null
  /** Data de entrada (YYYY-MM-DD) — habilita o botão de check-in só a partir dela. */
  checkin?: string | null
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [reasonTarget, setReasonTarget] = useState<ActionItem | null>(null)
  const [reason, setReason] = useState('')
  const actions = getActions(currentStatus, checkin)
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
              disabled={isPending || action.disabled}
              title={action.title}
              onClick={() => trigger(action)}
            >
              <Icon className="size-3" />
              {action.label}
            </Button>
          )
        })}
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
