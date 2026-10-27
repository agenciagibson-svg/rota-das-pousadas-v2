import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  PriceCalendarGrid,
  buildCalendarMonth,
  canGoToMonth,
  nextSelection,
  selectionHint,
  shiftMonth,
  type CalendarSelection,
  type PriceCalendarDay,
} from '@/features/reservas'

/**
 * Calendário com preço da página da bio (h6) — SEM JAVASCRIPT, como o resto
 * da página: cada dia é um link que recarrega a página com a data na URL
 * (`?checkin=` no primeiro toque, `&checkout=` no segundo). Com JavaScript o
 * Next faz a mesma navegação sem recarregar. O formulário de datas continua
 * logo acima, para quem prefere digitar.
 */
export function BioPriceCalendar({
  slug,
  month,
  days,
  today,
  selection,
  guests,
  open,
}: {
  slug: string
  month: string
  days: Record<string, PriceCalendarDay>
  today: string
  selection: CalendarSelection
  guests: number
  /** Aberto enquanto a pessoa não escolheu as duas datas. */
  open: boolean
}) {
  const view = buildCalendarMonth({ month, days, today, selection })

  function href(next: CalendarSelection, targetMonth: string): string {
    const params = new URLSearchParams()
    if (next.checkin) params.set('checkin', next.checkin)
    if (next.checkout) params.set('checkout', next.checkout)
    params.set('hospedes', String(guests))
    params.set('mes', targetMonth)
    // Sem JS a página recarrega no topo: falta escolher a saída → volta ao calendário.
    return `/${slug}?${params.toString()}${next.checkout ? '' : '#calendario'}`
  }

  const previous = shiftMonth(month, -1)
  const following = shiftMonth(month, 1)
  const navClass = cn(buttonVariants({ variant: 'ghost', size: 'icon-lg' }))

  return (
    <details
      id="calendario"
      open={open}
      className="bg-card shadow-card scroll-mt-4 rounded-3xl p-4"
    >
      <summary className="text-foreground cursor-pointer text-sm font-semibold">
        Ver diárias no calendário
      </summary>
      <div className="mt-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          {canGoToMonth(previous, today) ? (
            <Link
              href={href(selection, previous)}
              prefetch={false}
              scroll={false}
              aria-label="Mês anterior"
              className={navClass}
            >
              <ChevronLeft className="size-5" />
            </Link>
          ) : (
            <span aria-hidden="true" className="size-9" />
          )}
          <p className="text-foreground text-sm font-semibold">{view.title}</p>
          {canGoToMonth(following, today) ? (
            <Link
              href={href(selection, following)}
              prefetch={false}
              scroll={false}
              aria-label="Próximo mês"
              className={navClass}
            >
              <ChevronRight className="size-5" />
            </Link>
          ) : (
            <span aria-hidden="true" className="size-9" />
          )}
        </div>
        <PriceCalendarGrid
          month={view}
          hrefFor={(date) => href(nextSelection(selection, date, today, days), month)}
        />
        <p className="text-foreground mt-3 text-sm">{selectionHint(selection, today, days)}</p>
        <p className="text-muted-foreground mt-1 text-xs">
          Diária a partir de, em R$. Ponto amarelo: estadia mínima maior. Dia riscado: sem vaga.
        </p>
      </div>
    </details>
  )
}
