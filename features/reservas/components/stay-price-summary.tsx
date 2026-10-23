'use client'

import { CalendarClock } from 'lucide-react'
import { formatBRL } from '@/lib/format'
import { averageNightly, nightsBetween, quoteMatches, type StayQuote } from '../pricing'
import { cn } from '@/lib/utils'

/**
 * Resumo do valor da estadia. O total só aparece quando a cotação do servidor
 * é das mesmas datas que estão na tela (0087: temporada e fim de semana mudam a
 * diária noite a noite, e o navegador não sabe as regras). Enquanto a cotação
 * nova não chega, diz que está calculando — nunca mostra um total errado.
 */
export function StayPriceSummary({
  nightly,
  quote,
  checkin,
  checkout,
  calculating,
  className,
}: {
  nightly: number
  quote: StayQuote | null
  checkin: string
  checkout: string
  calculating: boolean
  className?: string
}) {
  const nights = checkin && checkout ? nightsBetween(checkin, checkout) : 0
  if (nights < 1) return null

  if (!quoteMatches(quote, checkin, checkout)) {
    return (
      <div
        aria-live="polite"
        className={cn('bg-secondary text-muted-foreground rounded-2xl p-4 text-sm', className)}
      >
        {calculating
          ? 'Calculando o valor dessas datas…'
          : 'O valor dessas datas aparece assim que a disponibilidade for confirmada.'}
      </div>
    )
  }

  if (quote.nights < quote.minNights) {
    return (
      <div
        role="alert"
        className={cn(
          'border-ipe/50 bg-ipe/15 text-foreground flex gap-3 rounded-2xl border p-4 text-sm',
          className,
        )}
      >
        <CalendarClock className="mt-0.5 size-5 shrink-0" />
        <p>
          <strong>Nessas datas a estadia mínima é de {quote.minNights} noites.</strong> Aumente o
          período para reservar.
        </p>
      </div>
    )
  }

  const seasonal = quote.total !== nightly * quote.nights
  return (
    <div
      aria-live="polite"
      className={cn('bg-secondary space-y-2 rounded-2xl p-4 text-sm tabular-nums', className)}
    >
      <div className="text-muted-foreground flex justify-between gap-3">
        <span>
          {formatBRL(seasonal ? averageNightly(quote) : nightly)} × {quote.nights}{' '}
          {quote.nights === 1 ? 'noite' : 'noites'}
          {seasonal && <span className="block text-xs">Média com tarifa da temporada</span>}
        </span>
        <span>{formatBRL(quote.total)}</span>
      </div>
      <div className="border-border text-foreground flex justify-between border-t pt-2 text-base font-semibold">
        <span>Total</span>
        <span>{formatBRL(quote.total)}</span>
      </div>
    </div>
  )
}

/** A reserva pode seguir com esta cotação? (datas na tela e mínimo de noites atendido) */
export function quoteAllowsBooking(
  quote: StayQuote | null,
  checkin: string,
  checkout: string,
): boolean {
  return quoteMatches(quote, checkin, checkout) && quote.nights >= quote.minNights
}
