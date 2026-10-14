'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatBRL, formatISODate } from '@/lib/format'
import { chargeConsumptionAction } from '../actions'
import type { InHouseBooking, SellableItem } from '../services/orders.service'

/**
 * Lança consumo numa reserva (ex.: conferência do frigobar no check-out).
 * Já entra como entregue e baixa o estoque.
 */
export function ChargeForm({
  bookings,
  items,
  fixedBookingId,
  onDone,
}: {
  bookings?: InHouseBooking[]
  items: SellableItem[]
  fixedBookingId?: string
  onDone: () => void
}) {
  const router = useRouter()
  const [bookingId, setBookingId] = useState(fixedBookingId ?? bookings?.[0]?.id ?? '')
  const [qty, setQty] = useState<Record<string, number>>({})
  const [note, setNote] = useState('')
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const selected = Object.entries(qty).filter(([, q]) => q > 0)
  const total = selected.reduce(
    (s, [id, q]) => s + (items.find((i) => i.id === id)?.price ?? 0) * q,
    0,
  )
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((i) => (q ? i.name.toLowerCase().includes(q) : true))
  }, [items, search])

  function change(id: string, delta: number) {
    setQty((prev) => {
      const item = items.find((i) => i.id === id)
      const max = item?.trackStock ? Math.min(20, Math.floor(item.quantity)) : 20
      const next = Math.max(0, Math.min(max, (prev[id] ?? 0) + delta))
      return { ...prev, [id]: next }
    })
  }

  async function submit() {
    setError(null)
    if (!bookingId) {
      setError('Escolha a reserva.')
      return
    }
    if (selected.length === 0) {
      setError('Escolha pelo menos um item.')
      return
    }
    setPending(true)
    try {
      const res = await chargeConsumptionAction({
        bookingId,
        items: selected.map(([itemId, quantity]) => ({ itemId, quantity })),
        note,
      })
      if (!res.ok) {
        setError(res.error)
        return
      }
      router.refresh()
      onDone()
    } catch {
      setError('Não foi possível lançar. Tente de novo.')
    } finally {
      setPending(false)
    }
  }

  if (items.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Nenhum item com preço de venda. Cadastre em Estoque e informe o preço para o hóspede.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {!fixedBookingId && (
        <label className="flex flex-col gap-1.5">
          <span className="text-foreground text-sm font-medium">Reserva</span>
          {bookings && bookings.length > 0 ? (
            <select
              value={bookingId}
              onChange={(e) => setBookingId(e.target.value)}
              className="border-input bg-card text-foreground rounded-xl border px-3.5 py-2.5 text-sm outline-none"
            >
              {bookings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.guestName} · {b.roomName} · {formatISODate(b.checkin)} a{' '}
                  {formatISODate(b.checkout)}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-muted-foreground text-sm">Nenhum hóspede na pousada hoje.</p>
          )}
        </label>
      )}

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar item"
        aria-label="Buscar item"
        className="border-input bg-card w-full rounded-xl border px-3.5 py-2 text-sm outline-none"
      />
      <ul className="divide-border max-h-[45vh] divide-y overflow-y-auto">
        {visible.map((i) => {
          const soldOut = i.trackStock && i.quantity < 1
          return (
            <li key={i.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <div className="text-foreground truncate text-sm font-medium">{i.name}</div>
                <div className="text-muted-foreground text-xs">
                  {i.price === 0 ? 'Cortesia' : formatBRL(i.price)}
                  {i.trackStock &&
                    ` · ${soldOut ? 'sem estoque' : `${Math.floor(i.quantity)} em estoque`}`}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  type="button"
                  size="icon-sm"
                  variant="outline"
                  aria-label={`Menos ${i.name}`}
                  disabled={!qty[i.id]}
                  onClick={() => change(i.id, -1)}
                >
                  <Minus />
                </Button>
                <span className="w-6 text-center text-sm font-semibold">{qty[i.id] ?? 0}</span>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="outline"
                  aria-label={`Mais ${i.name}`}
                  disabled={soldOut}
                  onClick={() => change(i.id, 1)}
                >
                  <Plus />
                </Button>
              </div>
            </li>
          )
        })}
      </ul>

      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={300}
        placeholder="Observação (ex.: conferência do frigobar)"
        aria-label="Observação"
        className="border-input bg-card w-full rounded-xl border px-3.5 py-2 text-sm outline-none"
      />

      {error && (
        <p role="alert" className="text-destructive text-sm font-medium">
          {error}
        </p>
      )}
      <div className="flex items-center justify-between gap-3">
        <span className="text-foreground text-sm font-semibold">Total: {formatBRL(total)}</span>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={pending || selected.length === 0}
            onClick={() => void submit()}
          >
            {pending ? 'Lançando…' : 'Lançar na conta'}
          </Button>
        </div>
      </div>
    </div>
  )
}
