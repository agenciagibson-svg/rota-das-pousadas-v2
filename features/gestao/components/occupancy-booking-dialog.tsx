'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ExternalLink, MoveRight } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { BOOKING_STATUS } from '@/features/reservas'
import { formatBRL, formatISODate, plural } from '@/lib/format'
import { isoNightsBetween } from '@/lib/dates'
import { SAVE_FAILED_MESSAGE } from '@/lib/forms'
import { moveBookingAction } from '../actions'
import {
  findMoveConflict,
  isSameTarget,
  moveCapabilities,
  priceEffect,
  shortDate,
  validateMoveTarget,
  type MoveTarget,
  type OccupancyBoard,
  type OccupancyBooking,
} from '../occupancy'
import { ORIGIN_LABEL } from './origin-labels'
import { OccupancyMoveFields } from './occupancy-move-fields'
import { OccupancyMoveSummary } from './occupancy-move-summary'
import { useMoveQuote } from './use-move-quote'

/**
 * Opções de uma barra do mapa. Do clique/teclado abre nos detalhes (abrir a
 * reserva ou "Mover"); depois de arrastar abre direto na confirmação, com o
 * destino preenchido e ainda editável.
 */
export function OccupancyBookingDialog({
  board,
  booking,
  initialTarget,
  onClose,
  onMoved,
}: {
  board: OccupancyBoard
  booking: OccupancyBooking
  initialTarget: MoveTarget | null
  onClose: () => void
  onMoved: (message: string) => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const caps = moveCapabilities(booking)
  const current: MoveTarget = {
    roomId: booking.roomId,
    checkin: booking.checkin,
    checkout: booking.checkout,
  }
  const [step, setStep] = useState<'details' | 'move'>(initialTarget ? 'move' : 'details')
  const [target, setTarget] = useState<MoveTarget>(initialTarget ?? current)
  const [reprice, setReprice] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const roomName = (id: string) => board.rooms.find((r) => r.id === id)?.name ?? 'Quarto'
  const unchanged = isSameTarget(booking, target)
  const problem =
    step === 'move' && !unchanged
      ? (validateMoveTarget(booking, target, board.today) ??
        findMoveConflict(board, booking, target)?.message ??
        null)
      : null
  const quote = useMoveQuote(target, step === 'move' && !unchanged && !problem)
  const effect = priceEffect(booking, quote.nights)
  const useNewValue = reprice && effect.repricedTotal !== null && !effect.repricedBelowPaid
  const status = BOOKING_STATUS[booking.status]
  const nights = isoNightsBetween(booking.checkin, booking.checkout)

  function confirm() {
    setError(null)
    startTransition(async () => {
      try {
        const res = await moveBookingAction({
          bookingId: booking.id,
          version: booking.version,
          ...target,
          reprice: useNewValue,
        })
        if (!res.ok) {
          setError(res.error)
          // Versão velha ou ocupação que o mapa não conhecia: traz o mapa atual.
          router.refresh()
          return
        }
        router.refresh()
        onMoved(
          `Reserva de ${booking.guestName}: ${roomName(target.roomId)}, ${shortDate(target.checkin)} a ${shortDate(target.checkout)}${
            res.data.total !== res.data.previousTotal
              ? `, novo valor ${formatBRL(res.data.total)}`
              : ''
          }.`,
        )
      } catch {
        setError(SAVE_FAILED_MESSAGE)
      }
    })
  }

  const footer =
    step === 'details' ? (
      <>
        <Link
          href={`/dashboard/reservas/${booking.id}`}
          className={buttonVariants({ variant: 'outline', size: 'touch' })}
        >
          <ExternalLink className="size-4" aria-hidden />
          Abrir reserva
        </Link>
        {(caps.canMove || caps.canResize) && (
          <Button size="touch" onClick={() => setStep('move')}>
            <MoveRight className="size-4" aria-hidden />
            {caps.canMove ? 'Mover' : 'Mudar saída'}
          </Button>
        )}
      </>
    ) : (
      <>
        <Button variant="outline" size="touch" onClick={onClose} disabled={pending}>
          Cancelar
        </Button>
        <Button size="touch" onClick={confirm} disabled={pending || unchanged || Boolean(problem)}>
          {pending ? 'Salvando…' : 'Confirmar mudança'}
        </Button>
      </>
    )

  return (
    <Dialog
      open
      onClose={onClose}
      title={step === 'move' ? `Mover reserva de ${booking.guestName}` : booking.guestName}
      description={`${booking.code} · ${ORIGIN_LABEL[booking.origin]}`}
      footer={footer}
    >
      {step === 'details' ? (
        <div className="space-y-3 text-sm">
          <Badge variant={status.variant}>{status.label}</Badge>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
            <dt className="text-muted-foreground">Quarto</dt>
            <dd>{roomName(booking.roomId)}</dd>
            <dt className="text-muted-foreground">Período</dt>
            <dd>
              {formatISODate(booking.checkin)} a {formatISODate(booking.checkout)} ·{' '}
              {plural(nights, 'noite', 'noites')}
            </dd>
            <dt className="text-muted-foreground">Hóspedes</dt>
            <dd>{booking.guests}</dd>
            <dt className="text-muted-foreground">Valor</dt>
            <dd>
              {formatBRL(booking.total)}
              {booking.amountReceived > 0 && ` (pago ${formatBRL(booking.amountReceived)})`}
            </dd>
          </dl>
          {caps.reason && <p className="text-muted-foreground text-xs">{caps.reason}</p>}
        </div>
      ) : (
        <div className="space-y-4">
          <OccupancyMoveFields
            rooms={board.rooms}
            target={target}
            onlyCheckout={!caps.canMove}
            onChange={(next) => {
              setTarget(next)
              setError(null)
            }}
          />
          {unchanged ? (
            <p className="text-muted-foreground text-sm">
              {caps.canMove
                ? 'Escolha o novo quarto ou as novas datas.'
                : 'Escolha a nova data de saída.'}
            </p>
          ) : problem ? (
            <p
              role="alert"
              className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-sm"
            >
              {problem}
            </p>
          ) : (
            <OccupancyMoveSummary
              fromRoom={roomName(booking.roomId)}
              toRoom={roomName(target.roomId)}
              from={current}
              to={target}
              effect={effect}
              amountReceived={booking.amountReceived}
              quoteLoading={quote.loading}
              quoteFailed={quote.failed}
              reprice={useNewValue}
              onRepriceChange={setReprice}
            />
          )}
          {error && (
            <p
              role="alert"
              className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-sm"
            >
              {error}
            </p>
          )}
        </div>
      )}
    </Dialog>
  )
}
