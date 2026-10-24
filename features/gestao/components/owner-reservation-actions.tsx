'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Flag, LogIn, LogOut, XCircle, Clock3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import type { BookingStatus } from '@/features/reservas/types'
import { formatBRL } from '@/lib/format'
import { can } from '@/lib/auth/rbac'
import { useDashboardRole } from '@/components/dashboard/role-context'
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
      {
        label: 'Cancelar',
        status: 'cancelled',
        icon: XCircle,
        variant: 'destructive',
        requiresReason: true,
      },
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
        title:
          canCheckInToday || !checkinISO
            ? undefined
            : `Check-in a partir de ${fmtDate(checkinISO)}`,
      },
      {
        label: 'Cancelar',
        status: 'cancelled',
        icon: XCircle,
        variant: 'destructive',
        requiresReason: true,
      },
      {
        label: 'Marcar no-show',
        status: 'no_show',
        icon: Flag,
        variant: 'secondary',
        requiresReason: true,
      },
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
  guestName,
  balanceDue = 0,
  consumptionDue,
}: {
  bookingId: string
  currentStatus: BookingStatus
  paymentDueAt?: string | null
  /** Data de entrada (YYYY-MM-DD) — habilita o botão de check-in só a partir dela. */
  checkin?: string | null
  /** Nome do hóspede, mostrado na confirmação do check-out. */
  guestName?: string
  /** Saldo em aberto (R$): o check-out avisa antes de encerrar a estadia com dívida. */
  balanceDue?: number
  /**
   * Consumo ainda não pago (R$), entregue ou não. Antes o check-out dizia
   * "A reserva está quitada" com águas do app em aberto. `undefined` = a
   * tela não carregou o consumo (Hoje, lista): não afirma que está quitada.
   */
  consumptionDue?: number
}) {
  const router = useRouter()
  const role = useDashboardRole()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [reasonTarget, setReasonTarget] = useState<ActionItem | null>(null)
  const [reason, setReason] = useState('')
  const [confirmCheckout, setConfirmCheckout] = useState(false)
  const actions = getActions(currentStatus, checkin)
  // Ações que encerram ou desfazem a reserva ficam numa linha separada da ação
  // principal: no celular, um toque errado em "Cancelar" ao lado de "Check-in"
  // era fácil demais.
  const primaryActions = actions.filter((a) => !a.variant || a.variant === 'default')
  const secondaryActions = actions.filter((a) => a.variant && a.variant !== 'default')
  const blockedHint = actions.find((a) => a.disabled && a.title)?.title
  const isOverduePending =
    currentStatus === 'pending' && !!paymentDueAt && paymentDueAt < new Date().toISOString()

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
    if (action.status === 'checked_out') {
      setConfirmCheckout(true)
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

  function renderAction(action: ActionItem) {
    const Icon = action.icon
    return (
      <Button
        key={action.status}
        type="button"
        size="touch"
        variant={action.variant ?? 'default'}
        disabled={isPending || action.disabled}
        onClick={() => trigger(action)}
      >
        <Icon className="size-4" />
        {action.label}
      </Button>
    )
  }

  // Financeiro vê a reserva para conferir pagamento, mas não muda o status.
  if (role && !can(role, 'booking:manage')) return null

  return (
    <div className="flex min-w-36 flex-col items-stretch gap-2">
      {primaryActions.length > 0 && (
        <div className="flex flex-wrap gap-2">{primaryActions.map(renderAction)}</div>
      )}
      {/* O motivo do botão desabilitado precisa ser visível: `title` não aparece no toque. */}
      {blockedHint && <span className="text-muted-foreground text-xs">{blockedHint}</span>}
      {secondaryActions.length > 0 && (
        <div className="border-border flex flex-wrap gap-2 border-t pt-2">
          {secondaryActions.map(renderAction)}
        </div>
      )}
      {isOverduePending && (
        <Button
          type="button"
          size="touch"
          variant="ghost"
          disabled={isPending}
          onClick={() => run(expireOwnerPendingBookingAction({ bookingId }))}
        >
          <Clock3 className="size-4" />
          Expirar (prazo vencido)
        </Button>
      )}
      {actions.length === 0 && !isOverduePending && (
        <span className="text-muted-foreground text-xs">Sem ações</span>
      )}
      {error && (
        <span role="alert" className="text-destructive text-xs font-medium">
          {error}
        </span>
      )}

      <Dialog
        open={confirmCheckout}
        onClose={() => setConfirmCheckout(false)}
        title="Fazer o check-out?"
        description={
          guestName
            ? `Encerra a estadia de ${guestName} e libera a acomodação para a governança.`
            : 'Encerra a estadia e libera a acomodação para a governança.'
        }
        footer={
          <>
            <Button variant="ghost" size="touch" onClick={() => setConfirmCheckout(false)}>
              Voltar
            </Button>
            <Button
              size="touch"
              onClick={() => {
                setConfirmCheckout(false)
                run(updateReservationStatusAction({ bookingId, status: 'checked_out' }))
              }}
            >
              <LogOut className="size-4" />
              Confirmar check-out
            </Button>
          </>
        }
      >
        {balanceDue > 0 || (consumptionDue ?? 0) > 0 ? (
          <div className="border-ipe/50 bg-ipe/15 text-foreground space-y-1 rounded-xl border p-3 text-sm">
            {balanceDue > 0 && (
              <p>
                Ainda falta receber <strong>{formatBRL(balanceDue)}</strong> da diária.
              </p>
            )}
            {(consumptionDue ?? 0) > 0 && (
              <p>
                Consumo em aberto: <strong>{formatBRL(consumptionDue ?? 0)}</strong> (pedidos do app
                e lançamentos da equipe).
              </p>
            )}
            <p>Registre o pagamento antes de encerrar, se o hóspede já pagou.</p>
          </div>
        ) : consumptionDue === undefined ? (
          <p className="text-muted-foreground text-sm">
            A diária está quitada. Confira a conta de consumo na reserva antes de encerrar.
          </p>
        ) : (
          <p className="text-muted-foreground text-sm">A reserva está quitada.</p>
        )}
      </Dialog>

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
          className="border-input bg-card text-foreground focus:border-ring focus:ring-ring/20 w-full resize-none rounded-xl border px-3.5 py-2.5 text-sm transition outline-none focus:ring-3"
        />
      </Dialog>
    </div>
  )
}
