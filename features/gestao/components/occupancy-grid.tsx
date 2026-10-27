'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  busyNightsByRoom,
  newBookingHref,
  shortDate,
  weekdayShort,
  windowNights,
  type MoveTarget,
  type OccupancyBoard,
  type OccupancyBooking,
} from '../occupancy'
import { BookingBar, DropPreview, HoldBar } from './occupancy-bars'
import { OccupancyBookingDialog } from './occupancy-booking-dialog'
import { useOccupancyDrag } from './use-occupancy-drag'

/** Coluna de noite com 48px (alvo de toque ≥ 44px). */
const CELL = 'w-12 shrink-0'
const ROOM_COL = 'bg-card sticky left-0 z-30 w-28 shrink-0 border-r sm:w-40'

type Selected = { booking: OccupancyBooking; target: MoveTarget | null }

/**
 * Mapa de ocupação: quartos nas linhas, noites nas colunas. Clicar numa noite
 * livre abre "Nova reserva" com quarto e entrada preenchidos; clicar numa
 * barra abre as opções (abrir, mover); no computador dá para arrastar a barra
 * (outro quarto/datas) ou puxar a borda direita (mudar a saída).
 */
export function OccupancyGrid({ board }: { board: OccupancyBoard }) {
  const [selected, setSelected] = useState<Selected | null>(null)
  const [notice, setNotice] = useState<{ tone: 'error' | 'ok'; text: string } | null>(null)
  const nights = useMemo(() => windowNights(board.from, board.days), [board.from, board.days])
  const busy = useMemo(() => busyNightsByRoom(board), [board])
  const roomName = useMemo(() => new Map(board.rooms.map((r) => [r.id, r.name])), [board.rooms])

  const drag = useOccupancyDrag({
    board,
    onDrop: (booking, target) => {
      setNotice(null)
      setSelected({ booking, target })
    },
    onReject: (text) => setNotice({ tone: 'error', text: `Não dá para soltar aí: ${text}` }),
  })

  return (
    <div>
      <div className="overflow-x-auto overscroll-x-contain rounded-xl border">
        <div className="min-w-max">
          <div className="bg-card flex border-b">
            <div
              className={cn(
                ROOM_COL,
                'text-muted-foreground flex items-end px-3 py-2 text-xs font-semibold',
              )}
            >
              Quarto
            </div>
            {nights.map((night) => (
              <div
                key={night}
                className={cn(
                  CELL,
                  'flex flex-col items-center py-1.5 text-center text-xs',
                  night === board.today && 'bg-ipe/15 text-foreground font-semibold',
                  night < board.today && 'text-muted-foreground',
                )}
              >
                <span className="uppercase">
                  {night === board.today ? 'hoje' : weekdayShort(night)}
                </span>
                <span className="text-foreground font-medium">{shortDate(night)}</span>
              </div>
            ))}
          </div>

          {board.rooms.map((room) => {
            const roomBusy = busy.get(room.id)
            return (
              <div key={room.id} data-occupancy-row className="flex h-14 border-b last:border-b-0">
                <div className={cn(ROOM_COL, 'flex flex-col justify-center px-3')}>
                  <span className="text-foreground truncate text-sm font-medium">{room.name}</span>
                  <span className="text-muted-foreground truncate text-xs">
                    {room.unavailable ? 'Em manutenção' : `até ${room.capacity} hósp.`}
                  </span>
                </div>
                <div data-occupancy-track className="relative flex">
                  {nights.map((night) => {
                    const free = !roomBusy?.has(night) && night >= board.today && !room.unavailable
                    return (
                      <div
                        key={night}
                        className={cn(
                          CELL,
                          'h-full border-r last:border-r-0',
                          night === board.today && 'bg-ipe/10',
                          night < board.today && 'bg-muted/40',
                        )}
                      >
                        {free && (
                          <Link
                            href={newBookingHref(room.id, night)}
                            aria-label={`Nova reserva: ${room.name}, entrada ${shortDate(night)}`}
                            className="group hover:bg-secondary focus-visible:ring-ring flex size-full items-center justify-center focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
                          >
                            <Plus
                              className="text-muted-foreground size-4 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                              aria-hidden
                            />
                          </Link>
                        )}
                      </div>
                    )
                  })}
                  {board.holds
                    .filter((h) => h.roomId === room.id)
                    .map((h) => (
                      <HoldBar key={h.id} hold={h} from={board.from} days={board.days} />
                    ))}
                  {board.bookings
                    .filter((b) => b.roomId === room.id)
                    .map((b) => (
                      <BookingBar
                        key={b.id}
                        booking={b}
                        from={board.from}
                        days={board.days}
                        roomName={room.name}
                        dragging={drag.preview?.bookingId === b.id}
                        onOpen={() => {
                          if (drag.consumeDragClick()) return
                          setNotice(null)
                          setSelected({ booking: b, target: null })
                        }}
                        onPointerDown={(e, mode) => drag.begin(e, b, mode)}
                        onPointerMove={drag.move}
                        onPointerUp={drag.end}
                        onPointerCancel={drag.cancel}
                      />
                    ))}
                  {drag.preview?.target.roomId === room.id && (
                    <DropPreview preview={drag.preview} from={board.from} days={board.days} />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <p aria-live="polite" className="text-muted-foreground mt-2 min-h-5 text-xs">
        {drag.preview
          ? `${roomName.get(drag.preview.target.roomId) ?? ''}: ${shortDate(drag.preview.target.checkin)} a ${shortDate(drag.preview.target.checkout)}${drag.preview.problem ? ` — ${drag.preview.problem}` : ''}`
          : ''}
      </p>
      {notice && (
        <p
          role={notice.tone === 'error' ? 'alert' : 'status'}
          className={cn(
            'mt-1 rounded-lg px-3 py-2 text-sm',
            notice.tone === 'error'
              ? 'bg-destructive/10 text-destructive'
              : 'bg-success/10 text-success',
          )}
        >
          {notice.text}
        </p>
      )}

      {selected && (
        <OccupancyBookingDialog
          board={board}
          booking={selected.booking}
          initialTarget={selected.target}
          onClose={() => setSelected(null)}
          onMoved={(text) => {
            setSelected(null)
            setNotice({ tone: 'ok', text })
          }}
        />
      )}
    </div>
  )
}
