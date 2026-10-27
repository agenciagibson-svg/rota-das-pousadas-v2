'use client'

import { addDaysToISODate, isoNightsBetween } from '@/lib/dates'
import type { MoveTarget, OccupancyRoom } from '../occupancy'

const inputClass =
  'border-input bg-card text-foreground focus:border-ring h-11 w-full rounded-lg border px-3 text-sm outline-none disabled:opacity-60'

/**
 * Formulário de "Mover": quarto, entrada e saída. É o caminho do celular (onde
 * arrastar é ruim) e do teclado. Em estadia só a saída fica editável.
 */
export function OccupancyMoveFields({
  rooms,
  target,
  onlyCheckout,
  onChange,
}: {
  rooms: OccupancyRoom[]
  target: MoveTarget
  onlyCheckout: boolean
  onChange: (next: MoveTarget) => void
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <label className="block sm:col-span-3">
        <span className="text-muted-foreground mb-1 block text-xs font-medium">Quarto</span>
        <select
          value={target.roomId}
          disabled={onlyCheckout}
          onChange={(e) => onChange({ ...target, roomId: e.target.value })}
          className={inputClass}
        >
          {rooms.map((r) => (
            <option key={r.id} value={r.id} disabled={r.unavailable}>
              {r.name} · até {r.capacity} hósp.{r.unavailable ? ' · em manutenção' : ''}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-muted-foreground mb-1 block text-xs font-medium">Entrada</span>
        <input
          type="date"
          value={target.checkin}
          disabled={onlyCheckout}
          onChange={(e) => {
            const checkin = e.target.value
            // Mudar a entrada leva a saída junto, como ao arrastar a barra.
            const nights = Math.max(1, isoNightsBetween(target.checkin, target.checkout))
            onChange({
              ...target,
              checkin,
              checkout: /^\d{4}-\d{2}-\d{2}$/.test(checkin)
                ? addDaysToISODate(checkin, nights)
                : target.checkout,
            })
          }}
          className={inputClass}
        />
      </label>
      <label className="block">
        <span className="text-muted-foreground mb-1 block text-xs font-medium">Saída</span>
        <input
          type="date"
          value={target.checkout}
          min={target.checkin}
          onChange={(e) => onChange({ ...target, checkout: e.target.value })}
          className={inputClass}
        />
      </label>
      <p className="text-muted-foreground self-end text-xs sm:pb-3">
        {onlyCheckout
          ? 'Hóspede em estadia: só a saída muda.'
          : 'Mudar a entrada leva a saída junto (mesmo número de noites).'}
      </p>
    </div>
  )
}
