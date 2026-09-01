'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { buildMonthGrid, expandOccupied, type DateRange } from '../calendar'
import { blockDateAction, unblockDateAction } from '../actions'
import { cn } from '@/lib/utils'

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export function ReservationsCalendar({
  occupied,
  blocked: initialBlocked,
}: {
  occupied: DateRange[]
  blocked: string[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const now = new Date()
  const [year, setYear] = useState(now.getUTCFullYear())
  const [month, setMonth] = useState(now.getUTCMonth())
  const [blocked, setBlocked] = useState<Set<string>>(new Set(initialBlocked))

  const occupiedSet = useMemo(() => expandOccupied(occupied), [occupied])
  const grid = useMemo(
    () => buildMonthGrid(year, month, occupiedSet, blocked),
    [year, month, occupiedSet, blocked],
  )

  function move(delta: number) {
    const d = new Date(Date.UTC(year, month + delta, 1))
    setYear(d.getUTCFullYear())
    setMonth(d.getUTCMonth())
  }

  function toggle(date: string, status: string) {
    if (status === 'booked' || status === 'past') return
    const next = new Set(blocked)
    const willBlock = status !== 'blocked'
    if (willBlock) next.add(date)
    else next.delete(date)
    setBlocked(next)
    startTransition(async () => {
      const res = willBlock ? await blockDateAction({ date }) : await unblockDateAction({ date })
      if (!res.ok) {
        // reverte em caso de erro
        setBlocked((prev) => {
          const revert = new Set(prev)
          if (willBlock) revert.delete(date)
          else revert.add(date)
          return revert
        })
        return
      }
      router.refresh()
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground">
          {MONTHS[month]} de {year}
        </h3>
        <div className="flex gap-1">
          <button
            onClick={() => move(-1)}
            aria-label="Mês anterior"
            className="flex size-8 items-center justify-center rounded-lg border border-border text-foreground transition-colors hover:bg-secondary"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            onClick={() => move(1)}
            aria-label="Próximo mês"
            className="flex size-8 items-center justify-center rounded-lg border border-border text-foreground transition-colors hover:bg-secondary"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted-foreground">
        {WEEKDAYS.map((w, i) => (
          <span key={i} className="py-2">
            {w}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {grid.map((d) => {
          const clickable = d.inMonth && (d.status === 'free' || d.status === 'blocked')
          return (
            <button
              key={d.date}
              disabled={!clickable || pending}
              onClick={() => toggle(d.date, d.status)}
              title={
                d.status === 'booked'
                  ? 'Reservado'
                  : d.status === 'blocked'
                    ? 'Bloqueado — clique para liberar'
                    : d.status === 'free'
                      ? 'Livre — clique para bloquear'
                      : ''
              }
              className={cn(
                'aspect-square rounded-lg text-sm font-medium transition-colors',
                !d.inMonth && 'opacity-30',
                d.status === 'past' && 'cursor-not-allowed text-muted-foreground/40',
                d.status === 'free' && 'text-foreground hover:bg-secondary',
                d.status === 'booked' && 'cursor-not-allowed bg-primary/15 text-primary',
                d.status === 'blocked' && 'bg-destructive/10 text-destructive line-through',
              )}
            >
              {d.day}
            </button>
          )
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded bg-primary/15" /> Reservado
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded bg-destructive/10" /> Bloqueado
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded border border-border" /> Livre (clique para bloquear)
        </span>
      </div>
    </div>
  )
}
