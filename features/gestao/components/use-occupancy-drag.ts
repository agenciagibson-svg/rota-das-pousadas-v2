'use client'

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import {
  cellsFromPixels,
  draggedTarget,
  findMoveConflict,
  isSameTarget,
  moveCapabilities,
  validateMoveTarget,
  type MoveTarget,
  type OccupancyBoard,
  type OccupancyBooking,
} from '../occupancy'

/** Abaixo disso é clique, não arrasto (mão tremendo no mouse). */
const DRAG_THRESHOLD_PX = 4

export type DragMode = 'move' | 'resize'

export type DragPreview = {
  bookingId: string
  target: MoveTarget
  /** Motivo de não poder soltar aí (regra ou conflito visível no mapa). */
  problem: string | null
}

type DragStart = {
  booking: OccupancyBooking
  mode: DragMode
  pointerId: number
  x: number
  y: number
  colWidth: number
  rowHeight: number
  roomIndex: number
}

/**
 * Arrastar barra com Pointer Events nativos (sem biblioteca). Só mouse e
 * caneta: no toque o gesto é de rolar o mapa, e a mudança é feita pelo
 * "Mover" do menu da barra (que também é a alternativa de teclado).
 */
export function useOccupancyDrag({
  board,
  onDrop,
  onReject,
}: {
  board: OccupancyBoard
  onDrop: (booking: OccupancyBooking, target: MoveTarget) => void
  onReject: (message: string) => void
}) {
  const start = useRef<DragStart | null>(null)
  const moved = useRef(false)
  const swallowClick = useRef(false)
  const [preview, setPreview] = useState<DragPreview | null>(null)

  function compute(clientX: number, clientY: number): DragPreview | null {
    const s = start.current
    if (!s) return null
    const dayDelta = cellsFromPixels(clientX - s.x, s.colWidth)
    const rowDelta = s.mode === 'move' ? cellsFromPixels(clientY - s.y, s.rowHeight) : 0
    const index = Math.min(board.rooms.length - 1, Math.max(0, s.roomIndex + rowDelta))
    const target = draggedTarget(s.booking, s.mode, dayDelta, board.rooms[index]!.id)
    if (isSameTarget(s.booking, target)) return null
    const problem =
      validateMoveTarget(s.booking, target, board.today) ??
      findMoveConflict(board, s.booking, target)?.message ??
      null
    return { bookingId: s.booking.id, target, problem }
  }

  function begin(e: ReactPointerEvent<HTMLElement>, booking: OccupancyBooking, mode: DragMode) {
    if (e.pointerType === 'touch' || e.button !== 0) return
    const caps = moveCapabilities(booking)
    if ((mode === 'move' && !caps.canMove) || (mode === 'resize' && !caps.canResize)) return
    const track = e.currentTarget.closest<HTMLElement>('[data-occupancy-track]')
    const row = e.currentTarget.closest<HTMLElement>('[data-occupancy-row]')
    if (!track || !row) return
    // A alça de redimensionar fica dentro da barra: não deixa a barra começar outro arrasto.
    e.stopPropagation()
    start.current = {
      booking,
      mode,
      pointerId: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      colWidth: track.getBoundingClientRect().width / board.days,
      rowHeight: row.getBoundingClientRect().height,
      roomIndex: board.rooms.findIndex((r) => r.id === booking.roomId),
    }
    moved.current = false
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function move(e: ReactPointerEvent<HTMLElement>) {
    const s = start.current
    if (!s || e.pointerId !== s.pointerId) return
    if (!moved.current && Math.hypot(e.clientX - s.x, e.clientY - s.y) < DRAG_THRESHOLD_PX) return
    moved.current = true
    setPreview(compute(e.clientX, e.clientY))
  }

  function end(e: ReactPointerEvent<HTMLElement>) {
    const s = start.current
    if (!s || e.pointerId !== s.pointerId) return
    const result = moved.current ? compute(e.clientX, e.clientY) : null
    start.current = null
    setPreview(null)
    if (!moved.current) return
    swallowClick.current = true
    if (!result) return
    if (result.problem) onReject(result.problem)
    else onDrop(s.booking, result.target)
  }

  function cancel() {
    if (moved.current) swallowClick.current = true
    start.current = null
    setPreview(null)
  }

  // Esc cancela o arrasto em andamento.
  const dragging = preview !== null
  useEffect(() => {
    if (!dragging) return
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape') return
      swallowClick.current = true
      start.current = null
      setPreview(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dragging])

  /** O clique que vem logo depois de soltar um arrasto não abre o menu. */
  function consumeDragClick(): boolean {
    if (!swallowClick.current) return false
    swallowClick.current = false
    return true
  }

  return { preview, begin, move, end, cancel, consumeDragClick }
}
