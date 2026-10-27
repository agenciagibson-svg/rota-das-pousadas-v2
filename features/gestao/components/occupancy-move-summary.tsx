'use client'

import { ArrowRight } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { formatBRL, formatISODate, plural } from '@/lib/format'
import { isoNightsBetween } from '@/lib/dates'
import { cn } from '@/lib/utils'
import type { MoveTarget, PriceEffect } from '../occupancy'

function Place({
  label,
  room,
  t,
  changed,
}: {
  label: string
  room: string
  t: MoveTarget
  changed?: (keyof MoveTarget)[]
}) {
  const nights = isoNightsBetween(t.checkin, t.checkout)
  const mark = (k: keyof MoveTarget) =>
    changed?.includes(k) ? 'text-foreground font-semibold' : ''
  return (
    <div className="min-w-0 flex-1">
      <p className="text-muted-foreground text-xs font-semibold uppercase">{label}</p>
      <p className={cn('truncate text-sm', mark('roomId'))}>{room}</p>
      <p className="text-sm">
        <span className={mark('checkin')}>{formatISODate(t.checkin)}</span> a{' '}
        <span className={mark('checkout')}>{formatISODate(t.checkout)}</span>
      </p>
      <p className="text-muted-foreground text-xs">
        {nights > 0 ? plural(nights, 'noite', 'noites') : '—'}
      </p>
    </div>
  )
}

/** De → para, e o efeito no valor com a escolha explícita de mudar ou não. */
export function OccupancyMoveSummary({
  fromRoom,
  toRoom,
  from,
  to,
  effect,
  amountReceived,
  quoteLoading,
  quoteFailed,
  reprice,
  onRepriceChange,
}: {
  fromRoom: string
  toRoom: string
  from: MoveTarget
  to: MoveTarget
  effect: PriceEffect
  amountReceived: number
  quoteLoading: boolean
  quoteFailed: boolean
  reprice: boolean
  onRepriceChange: (value: boolean) => void
}) {
  const changed = (['roomId', 'checkin', 'checkout'] as const).filter((k) => from[k] !== to[k])
  const sameValue = effect.repricedTotal !== null && effect.difference === 0
  const diff = effect.difference ?? 0
  return (
    <div className="space-y-3">
      <Card className="flex items-start gap-3 p-4">
        <Place label="De" room={fromRoom} t={from} />
        <ArrowRight className="text-muted-foreground mt-5 size-4 shrink-0" aria-hidden />
        <Place label="Para" room={toRoom} t={to} changed={[...changed]} />
      </Card>

      <fieldset className="space-y-2">
        <legend className="text-foreground text-sm font-semibold">Valor da reserva</legend>
        {effect.paid && (
          <p className="text-muted-foreground text-xs">
            Já foram pagos {formatBRL(amountReceived)}. O valor só muda se você escolher.
          </p>
        )}
        <label className="flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2 text-sm">
          <input
            type="radio"
            name="reprice"
            checked={!reprice}
            onChange={() => onRepriceChange(false)}
          />
          <span>
            Manter o valor combinado: <strong>{formatBRL(effect.currentTotal)}</strong>
          </span>
        </label>
        {quoteLoading && <p className="text-muted-foreground text-xs">Calculando pelas tarifas…</p>}
        {quoteFailed && (
          <p className="text-muted-foreground text-xs">
            Não deu para calcular pelas tarifas agora; o valor combinado fica.
          </p>
        )}
        {sameValue && (
          <p className="text-muted-foreground text-xs">Pelas tarifas o valor é o mesmo.</p>
        )}
        {effect.repricedTotal !== null && !sameValue && (
          <label
            className={cn(
              'flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2 text-sm',
              effect.repricedBelowPaid && 'opacity-60',
            )}
          >
            <input
              type="radio"
              name="reprice"
              checked={reprice}
              disabled={effect.repricedBelowPaid}
              onChange={() => onRepriceChange(true)}
            />
            <span>
              Usar o valor novo pelas tarifas: <strong>{formatBRL(effect.repricedTotal)}</strong>{' '}
              <span className="text-muted-foreground">
                ({diff > 0 ? '+' : '−'}
                {formatBRL(Math.abs(diff))})
              </span>
              {effect.repricedBelowPaid && (
                <span className="text-destructive block text-xs">
                  Fica abaixo do que já foi pago. Para devolver dinheiro, use Editar reserva.
                </span>
              )}
            </span>
          </label>
        )}
        <p className="text-muted-foreground text-xs">
          O valor novo troca só as diárias; desconto, acréscimo e serviços continuam como estão.
        </p>
      </fieldset>
    </div>
  )
}
