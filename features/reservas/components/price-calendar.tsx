'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  buildCalendarMonth,
  canGoToMonth,
  clampMonth,
  isCalendarDate,
  monthOf,
  nextSelection,
  selectionHint,
  shiftMonth,
  type CalendarSelection,
} from '../price-calendar'
import { PriceCalendarGrid } from './price-calendar-grid'
import { usePriceCalendar } from './use-price-calendar'

/**
 * Calendário com a diária de cada dia (h6). Fica junto dos campos de data:
 * os campos continuam funcionando (digitar a data, teclado, leitor de tela) e
 * o calendário é o atalho visual — tocar na entrada e depois na saída.
 *
 * O preço mostrado é o "a partir de" do servidor (menor diária livre naquela
 * noite, com temporada/fim de semana/feriado). O total da estadia continua
 * vindo da cotação do servidor, como antes.
 */
export function PriceCalendar({
  slug,
  guests,
  roomId,
  today,
  checkin,
  checkout,
  onChange,
  className,
  id,
}: {
  slug: string
  guests: number
  /** Acomodação escolhida pela pessoa (ex.: na bio). Sem ela, todas as visíveis. */
  roomId?: string
  today: string
  checkin: string
  checkout: string
  onChange: (selection: CalendarSelection) => void
  className?: string
  id?: string
}) {
  const [month, setMonth] = useState(() =>
    clampMonth(monthOf(isCalendarDate(checkin) ? checkin : today), today),
  )
  const safeGuests = Math.min(20, Math.max(1, Math.floor(guests) || 1))
  const { days, loading, failed } = usePriceCalendar({ slug, month, guests: safeGuests, roomId })
  const selection = {
    checkin: isCalendarDate(checkin) ? checkin : '',
    checkout: isCalendarDate(checkout) && checkout > checkin ? checkout : '',
  }
  const view = buildCalendarMonth({ month, days, today, selection })
  const previous = shiftMonth(month, -1)
  const next = shiftMonth(month, 1)

  function select(date: string) {
    const result = nextSelection(selection, date, today, days)
    if (result !== selection) onChange(result)
  }

  return (
    <div id={id} className={cn('bg-secondary/60 rounded-2xl p-3', className)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          aria-label="Mês anterior"
          disabled={!canGoToMonth(previous, today)}
          onClick={() => setMonth(previous)}
        >
          <ChevronLeft className="size-5" />
        </Button>
        <p className="text-foreground text-sm font-semibold" aria-live="polite">
          {view.title}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          aria-label="Próximo mês"
          disabled={!canGoToMonth(next, today)}
          onClick={() => setMonth(next)}
        >
          <ChevronRight className="size-5" />
        </Button>
      </div>

      <PriceCalendarGrid month={view} loading={loading} onSelect={select} />

      <p className="text-foreground mt-3 text-sm" aria-live="polite">
        {selectionHint(selection, today, days)}
      </p>
      <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span>Diária a partir de, em R$</span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="bg-ipe size-1 rounded-full" />
          estadia mínima maior
        </span>
        <span>
          <span aria-hidden="true" className="line-through">
            12
          </span>{' '}
          sem vaga
        </span>
      </p>
      {failed && (
        <p role="alert" className="text-muted-foreground mt-2 text-xs">
          Não conseguimos carregar os preços deste mês agora. Você ainda pode escolher as datas.
        </p>
      )}
    </div>
  )
}
