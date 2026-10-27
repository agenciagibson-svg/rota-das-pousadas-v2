'use client'

import type { PointerEvent as ReactPointerEvent } from 'react'
import { BedDouble, Clock, Link2, Lock } from 'lucide-react'
import { badgeVariants } from '@/components/ui/badge'
import { BOOKING_STATUS } from '@/features/reservas'
import { cn } from '@/lib/utils'
import { plural } from '@/lib/format'
import { isoNightsBetween } from '@/lib/dates'
import {
  barPlacement,
  moveCapabilities,
  shortDate,
  type OccupancyBooking,
  type OccupancyHold,
} from '../occupancy'
import type { DragMode, DragPreview } from './use-occupancy-drag'

/**
 * Posição na faixa do quarto em % da janela. É geometria calculada em tempo
 * de execução (como a largura de uma barra de progresso) — a exceção técnica
 * de `style` prevista no AI_RULES; cor e forma vêm das classes.
 */
function geometry(start: number, span: number, days: number) {
  return { left: `${(start / days) * 100}%`, width: `${(span / days) * 100}%` }
}

const BAR = 'absolute top-1.5 flex h-11 items-center overflow-hidden rounded-lg px-2 text-xs'

export function BookingBar({
  booking,
  from,
  days,
  roomName,
  dragging,
  onOpen,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: {
  booking: OccupancyBooking
  from: string
  days: number
  roomName: string
  dragging: boolean
  onOpen: () => void
  onPointerDown: (e: ReactPointerEvent<HTMLElement>, mode: DragMode) => void
  onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void
  onPointerUp: (e: ReactPointerEvent<HTMLElement>) => void
  onPointerCancel: () => void
}) {
  const place = barPlacement(booking.checkin, booking.checkout, from, days)
  if (!place) return null
  const status = BOOKING_STATUS[booking.status]
  const caps = moveCapabilities(booking)
  const nights = plural(isoNightsBetween(booking.checkin, booking.checkout), 'noite', 'noites')
  const summary = `${booking.guestName}, ${roomName}, ${shortDate(booking.checkin)} a ${shortDate(booking.checkout)}, ${nights}, ${status.label}`
  const Icon =
    booking.status === 'checked_in' ? BedDouble : booking.status === 'pending' ? Clock : null

  return (
    // Barra de status: cores do Badge (variantes de BOOKING_STATUS). É um
    // <button> nativo porque o `Button` traz altura, raio e hover próprios que
    // brigam com uma barra posicionada e arrastável.
    <button
      type="button"
      data-booking-id={booking.id}
      title={summary}
      aria-label={`${summary}. Abrir opções da reserva.`}
      onClick={onOpen}
      onPointerDown={(e) => onPointerDown(e, 'move')}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      className={cn(
        badgeVariants({ variant: status.variant, size: 'sm' }),
        BAR,
        'z-10 justify-start gap-1 text-left select-none hover:brightness-95',
        'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
        caps.canMove && 'pointer-fine:cursor-grab',
        place.cutStart && 'rounded-l-none',
        place.cutEnd && 'rounded-r-none',
        booking.status === 'checked_out' && 'opacity-70',
        dragging && 'opacity-40',
      )}
      style={geometry(place.start, place.span, days)}
    >
      {Icon && <Icon className="size-3.5 shrink-0" aria-hidden />}
      <span className="truncate font-semibold">{booking.guestName}</span>
      {caps.canResize && !place.cutEnd && (
        <span
          aria-hidden
          onPointerDown={(e) => onPointerDown(e, 'resize')}
          className="absolute inset-y-0 right-0 w-2 cursor-ew-resize rounded-r-lg hover:bg-current/20 pointer-coarse:hidden"
        />
      )}
    </button>
  )
}

export function HoldBar({ hold, from, days }: { hold: OccupancyHold; from: string; days: number }) {
  const place = barPlacement(hold.startsOn, hold.endsOn, from, days)
  if (!place) return null
  const channel = hold.kind === 'channel'
  const text = channel ? `Ocupado no ${hold.label}` : `Bloqueado: ${hold.label}`
  return (
    <div
      title={text}
      className={cn(
        BAR,
        'gap-1 border border-dashed',
        channel
          ? 'border-border bg-muted text-muted-foreground'
          : 'border-destructive/40 bg-destructive/5 text-destructive',
        place.cutStart && 'rounded-l-none',
        place.cutEnd && 'rounded-r-none',
      )}
      style={geometry(place.start, place.span, days)}
    >
      {channel ? (
        <Link2 className="size-3.5 shrink-0" aria-hidden />
      ) : (
        <Lock className="size-3.5 shrink-0" aria-hidden />
      )}
      <span className="truncate">{text}</span>
    </div>
  )
}

/** Fantasma do arrasto: onde a reserva vai cair (contorno vermelho se não pode). */
export function DropPreview({
  preview,
  from,
  days,
}: {
  preview: DragPreview
  from: string
  days: number
}) {
  const place = barPlacement(preview.target.checkin, preview.target.checkout, from, days)
  if (!place) return null
  return (
    <div
      aria-hidden
      className={cn(
        BAR,
        'pointer-events-none z-20 border-2 border-dashed',
        preview.problem ? 'border-destructive bg-destructive/10' : 'border-primary bg-primary/10',
      )}
      style={geometry(place.start, place.span, days)}
    />
  )
}
