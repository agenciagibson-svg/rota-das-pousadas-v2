'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  buildMonthGrid,
  buildPousadaMonthGrid,
  expandOccupied,
  type CalendarDay,
  type DateRange,
  type RoomDay,
} from '../calendar'
import { blockDateAction, unblockDateAction } from '../actions'
import { cn } from '@/lib/utils'

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const MONTHS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

const ALL = 'all'

/**
 * Calendário da pousada por quarto. "Todos os quartos" mostra a ocupação
 * somada (lotado / parcial / livre) e bloqueia ou libera o dia em todos os
 * quartos livres; escolhendo um quarto, o clique vale só para ele.
 */
export function ReservationsCalendar({
  rooms,
  bookings,
  blocks,
  canBlock,
  todayISO,
}: {
  rooms: { id: string; name: string }[]
  bookings: (DateRange & { roomId: string })[]
  blocks: RoomDay[]
  canBlock: boolean
  /** Vem do servidor, no fuso da pousada: em UTC o dia de hoje virava "passado" às 21h. */
  todayISO: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const today = useMemo(() => new Date(`${todayISO}T12:00:00Z`), [todayISO])
  const [year, setYear] = useState(today.getUTCFullYear())
  const [month, setMonth] = useState(today.getUTCMonth())
  const [roomId, setRoomId] = useState<string>(rooms.length === 1 ? rooms[0]!.id : ALL)
  const [message, setMessage] = useState<{ tone: 'error' | 'ok'; text: string } | null>(null)

  const grid: CalendarDay[] = useMemo(() => {
    if (roomId === ALL) {
      return buildPousadaMonthGrid(
        year,
        month,
        rooms.map((r) => r.id),
        bookings,
        blocks,
        today,
      )
    }
    const occupied = expandOccupied(bookings.filter((b) => b.roomId === roomId))
    const blocked = new Set(blocks.filter((b) => b.roomId === roomId).map((b) => b.date))
    return buildMonthGrid(year, month, occupied, blocked, today)
  }, [roomId, year, month, rooms, bookings, blocks, today])

  function move(delta: number) {
    const d = new Date(Date.UTC(year, month + delta, 1))
    setYear(d.getUTCFullYear())
    setMonth(d.getUTCMonth())
  }

  function clickable(d: CalendarDay): boolean {
    if (!canBlock || !d.inMonth) return false
    if (roomId === ALL)
      return d.status === 'free' || d.status === 'blocked' || d.status === 'partial'
    return d.status === 'free' || d.status === 'blocked'
  }

  function toggle(d: CalendarDay) {
    if (!clickable(d)) return
    // Parcial em "todos os quartos": bloqueia os que ainda estão livres.
    const willBlock = d.status !== 'blocked'
    const target = roomId === ALL ? undefined : roomId
    setMessage(null)
    startTransition(async () => {
      const res = willBlock
        ? await blockDateAction({ date: d.date, roomId: target })
        : await unblockDateAction({ date: d.date, roomId: target })
      if (!res.ok) {
        setMessage({ tone: 'error', text: res.error })
        router.refresh()
        return
      }
      const [y, m, day] = d.date.split('-')
      const n = res.data.affected
      setMessage({
        tone: 'ok',
        text: `${day}/${m}/${y}: ${willBlock ? 'bloqueado' : 'liberado'}${
          roomId === ALL ? ` em ${n} ${n === 1 ? 'quarto' : 'quartos'}` : ''
        }.`,
      })
      router.refresh()
    })
  }

  function title(d: CalendarDay): string {
    const allView = roomId === ALL
    switch (d.status) {
      case 'booked':
        return allView ? 'Lotado — todos os quartos ocupados' : 'Reservado'
      case 'blocked':
        return canBlock ? 'Bloqueado — clique para liberar' : 'Bloqueado'
      case 'partial':
        return `${d.busyRooms} de ${d.totalRooms} quartos ocupados/bloqueados${
          canBlock ? ' — clique para bloquear os livres' : ''
        }`
      case 'free':
        if (!canBlock) return 'Livre'
        return allView
          ? 'Livre — clique para bloquear todos os quartos'
          : 'Livre — clique para bloquear'
      default:
        return ''
    }
  }

  if (rooms.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Cadastre um quarto em Acomodações para usar o calendário.
      </p>
    )
  }

  return (
    <div>
      {rooms.length > 1 && (
        <div className="mb-4">
          <label htmlFor="cal-room" className="text-foreground text-sm font-medium">
            Quarto
          </label>
          <select
            id="cal-room"
            value={roomId}
            onChange={(e) => {
              setRoomId(e.target.value)
              setMessage(null)
            }}
            className="border-input bg-card mt-1 w-full rounded-lg border px-3 py-2 text-sm"
          >
            <option value={ALL}>Todos os quartos ({rooms.length})</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-foreground font-semibold">
          {MONTHS[month]} de {year}
        </h3>
        <div className="flex gap-1">
          <button
            onClick={() => move(-1)}
            aria-label="Mês anterior"
            className="border-border text-foreground hover:bg-secondary flex size-8 items-center justify-center rounded-lg border transition-colors"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            onClick={() => move(1)}
            aria-label="Próximo mês"
            className="border-border text-foreground hover:bg-secondary flex size-8 items-center justify-center rounded-lg border transition-colors"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <div className="text-muted-foreground mt-4 grid grid-cols-7 gap-1 text-center text-xs font-semibold">
        {WEEKDAYS.map((w, i) => (
          <span key={i} className="py-2">
            {w}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {grid.map((d) => {
          const canClick = clickable(d)
          return (
            <button
              key={d.date}
              disabled={!canClick || pending}
              onClick={() => toggle(d)}
              title={title(d)}
              className={cn(
                'relative aspect-square rounded-lg text-sm font-medium transition-colors',
                !d.inMonth && 'opacity-30',
                d.status === 'past' && 'text-muted-foreground/40 cursor-not-allowed',
                d.status === 'free' && 'text-foreground',
                d.status === 'free' && canClick && 'hover:bg-secondary',
                d.status === 'booked' && 'bg-primary/15 text-primary cursor-not-allowed',
                d.status === 'blocked' && 'bg-destructive/10 text-destructive line-through',
                d.status === 'partial' && 'bg-ipe/25 text-foreground',
              )}
            >
              {d.day}
              {d.status === 'partial' && d.inMonth && (
                <span className="absolute inset-x-0 bottom-0.5 text-[9px] leading-none font-semibold">
                  {d.busyRooms}/{d.totalRooms}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {message && (
        <p
          role={message.tone === 'error' ? 'alert' : 'status'}
          className={cn(
            'mt-3 rounded-lg px-3 py-2 text-sm',
            message.tone === 'error'
              ? 'bg-destructive/10 text-destructive'
              : 'bg-success/10 text-success',
          )}
        >
          {message.text}
        </p>
      )}

      <div className="text-muted-foreground mt-4 flex flex-wrap gap-4 text-xs">
        <span className="inline-flex items-center gap-1.5">
          <span className="bg-primary/15 size-3 rounded" />{' '}
          {roomId === ALL ? 'Lotado' : 'Reservado'}
        </span>
        {roomId === ALL && rooms.length > 1 && (
          <span className="inline-flex items-center gap-1.5">
            <span className="bg-ipe/25 size-3 rounded" /> Parcial (ocupados/total)
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <span className="bg-destructive/10 size-3 rounded" /> Bloqueado
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="border-border size-3 rounded border" /> Livre
        </span>
      </div>
      {!canBlock && (
        <p className="text-muted-foreground mt-2 text-xs">
          Seu acesso ao calendário é só de consulta.
        </p>
      )}
    </div>
  )
}
