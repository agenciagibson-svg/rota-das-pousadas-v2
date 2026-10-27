import Link from 'next/link'
import { Button, buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import {
  WEEKDAYS,
  formatCalendarPrice,
  type CalendarCell,
  type CalendarMonth,
} from '../price-calendar'

/**
 * Grade de um mês com a diária em cada dia (h6). Sem estado e sem
 * `'use client'`: serve aos dois mundos —
 *  - com `onSelect`, cada dia é um botão (página da pousada e da reserva);
 *  - com `hrefFor`, cada dia é um link comum (página da bio, que funciona sem
 *    JavaScript: o clique recarrega a página com a data na URL).
 */
export function PriceCalendarGrid({
  month,
  loading = false,
  onSelect,
  hrefFor,
}: {
  month: CalendarMonth
  /** Preços do mês a caminho: mostra o espaço do preço pulsando. */
  loading?: boolean
  onSelect?: (date: string) => void
  hrefFor?: (date: string) => string
}) {
  return (
    <div role="group" aria-label={month.title}>
      <div aria-hidden="true" className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((weekday) => (
          <abbr
            key={weekday.long}
            title={weekday.long}
            className="text-muted-foreground py-1 text-center text-xs font-medium no-underline"
          >
            {weekday.short}
          </abbr>
        ))}
      </div>
      <ul className="grid grid-cols-7 gap-1">
        {month.weeks.flat().map((cell, index) => (
          <li key={cell?.date ?? `vazio-${index}`} className="min-w-0">
            {cell && (
              <DayCell cell={cell} loading={loading} onSelect={onSelect} hrefFor={hrefFor} />
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

const cellBase = 'relative h-12 w-full min-w-0 flex-col gap-0 rounded-xl px-0 tabular-nums'

function cellTone(cell: CalendarCell): string {
  if (cell.isCheckin || cell.isCheckout)
    return 'bg-primary text-primary-foreground hover:bg-primary'
  if (cell.inRange) return 'bg-secondary text-foreground hover:bg-secondary'
  if (!cell.selectable) return 'text-muted-foreground'
  return 'text-foreground'
}

function DayCell({
  cell,
  loading,
  onSelect,
  hrefFor,
}: {
  cell: CalendarCell
  loading: boolean
  onSelect?: (date: string) => void
  hrefFor?: (date: string) => string
}) {
  const selected = cell.isCheckin || cell.isCheckout
  const content = (
    <>
      <span
        className={cn(
          'text-sm font-medium',
          cell.status === 'unavailable' && !cell.selectable && 'line-through',
        )}
      >
        {cell.day}
      </span>
      {cell.price !== null ? (
        <span
          className={cn('text-xs', selected ? 'text-primary-foreground' : 'text-muted-foreground')}
        >
          {formatCalendarPrice(cell.price)}
        </span>
      ) : loading && cell.status === 'unknown' ? (
        <Skeleton className="mt-1 h-2 w-6" />
      ) : (
        // Mantém a altura da célula igual com ou sem preço.
        <span aria-hidden="true" className="text-xs">
          &nbsp;
        </span>
      )}
      {cell.minNights > 1 && cell.status === 'available' && (
        <span aria-hidden="true" className="bg-ipe absolute top-1 right-1 size-1 rounded-full" />
      )}
    </>
  )

  if (hrefFor) {
    if (!cell.selectable) {
      return (
        <span
          aria-label={cell.label}
          className={cn(cellBase, 'inline-flex items-center justify-center', cellTone(cell))}
        >
          {content}
        </span>
      )
    }
    return (
      <Link
        href={hrefFor(cell.date)}
        prefetch={false}
        scroll={false}
        aria-label={cell.label}
        aria-current={selected ? 'date' : undefined}
        className={cn(buttonVariants({ variant: 'ghost' }), cellBase, cellTone(cell))}
      >
        {content}
      </Link>
    )
  }

  return (
    <Button
      type="button"
      variant="ghost"
      disabled={!cell.selectable}
      aria-label={cell.label}
      aria-pressed={selected}
      onClick={() => onSelect?.(cell.date)}
      className={cn(cellBase, cellTone(cell), 'disabled:opacity-100')}
    >
      {content}
    </Button>
  )
}
