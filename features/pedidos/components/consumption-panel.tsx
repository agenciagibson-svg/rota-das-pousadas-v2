'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Receipt } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { formatBRL, formatDateTime } from '@/lib/format'
import { registerConsumptionPaymentAction } from '../actions'
import { ORDER_STATUS_LABEL, PAYMENT_METHOD_LABEL, type ConsumptionPayment } from '../types'
import type { BookingConsumption, SellableItem } from '../services/orders.service'
import { ChargeForm } from './charge-form'

/** Conta de consumo da reserva: pedidos, o que falta pagar e registrar pagamento. */
export function ConsumptionPanel({
  bookingId,
  data,
  sellable,
  bookingOpen,
}: {
  bookingId: string
  data: BookingConsumption
  sellable: SellableItem[]
  /** Reserva ainda não cancelada: dá para lançar consumo. */
  bookingOpen: boolean
}) {
  const router = useRouter()
  const [charging, setCharging] = useState(false)
  const [paying, setPaying] = useState(false)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<ConsumptionPayment['method']>('pix')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const { summary } = data
  const visibleOrders = data.orders.filter((o) => o.status !== 'cancelado')

  async function pay() {
    setError(null)
    setPending(true)
    try {
      const res = await registerConsumptionPaymentAction({
        bookingId,
        amount: amount.replace(',', '.'),
        method,
        note: '',
      })
      if (!res.ok) {
        setError(res.fieldErrors?.amount ?? res.error)
        return
      }
      setPaying(false)
      setAmount('')
      router.refresh()
    } catch {
      setError('Não foi possível registrar. Tente de novo.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-foreground flex items-center gap-2 font-semibold">
            <Receipt className="text-primary size-4" />
            Conta de consumo
          </h2>
          <p className="text-muted-foreground text-sm">
            Pedidos pelo app e lançados pela equipe. Separada da diária, paga no check-out.
          </p>
        </div>
        <div className="flex gap-2">
          {data.canCharge && bookingOpen && (
            <Button size="sm" variant="outline" onClick={() => setCharging(true)}>
              <Plus className="size-3.5" />
              Lançar consumo
            </Button>
          )}
          {data.canRegisterPayment && summary.balance > 0 && (
            <Button
              size="sm"
              onClick={() => {
                setAmount(summary.balance.toFixed(2))
                setPaying(true)
              }}
            >
              Registrar pagamento
            </Button>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="bg-secondary/60 rounded-xl p-3">
          <div className="text-muted-foreground text-xs">Consumido</div>
          <div className="text-foreground font-semibold">{formatBRL(summary.delivered)}</div>
          {summary.open > 0 && (
            <div className="text-muted-foreground text-xs">
              + {formatBRL(summary.open)} em andamento
            </div>
          )}
        </div>
        <div className="bg-secondary/60 rounded-xl p-3">
          <div className="text-muted-foreground text-xs">Pago</div>
          <div className="text-foreground font-semibold">{formatBRL(summary.paid)}</div>
        </div>
        <div className={`rounded-xl p-3 ${summary.balance > 0 ? 'bg-amber-50' : 'bg-emerald-50'}`}>
          <div className="text-muted-foreground text-xs">Falta pagar</div>
          <div
            className={`font-semibold ${summary.balance > 0 ? 'text-amber-800' : 'text-emerald-700'}`}
          >
            {summary.balance > 0 ? formatBRL(summary.balance) : 'Nada ✓'}
          </div>
        </div>
      </div>

      {visibleOrders.length > 0 ? (
        <ul className="divide-border mt-4 divide-y text-sm">
          {visibleOrders.map((o) => (
            <li key={o.id} className="flex items-start justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={o.status === 'entregue' ? 'secondary' : 'goldSoft'} size="sm">
                    {ORDER_STATUS_LABEL[o.status]}
                  </Badge>
                  <span className="text-muted-foreground text-xs">
                    {formatDateTime(o.createdAt)} · {o.source === 'equipe' ? 'equipe' : 'app'}
                  </span>
                </div>
                <p className="text-foreground mt-1">
                  {o.lines.map((l) => `${l.quantity}× ${l.name}`).join(', ')}
                </p>
              </div>
              <span className="text-foreground shrink-0 font-medium whitespace-nowrap">
                {formatBRL(o.total)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground mt-4 text-sm">Nenhum consumo nesta reserva.</p>
      )}

      {data.payments.length > 0 && (
        <div className="mt-3 border-t pt-3">
          <p className="text-muted-foreground text-xs font-semibold uppercase">
            Pagamentos do consumo
          </p>
          <ul className="mt-1 space-y-1 text-sm">
            {data.payments.map((p) => (
              <li key={p.id} className="flex justify-between gap-3">
                <span className="text-muted-foreground">
                  {formatDateTime(p.createdAt)} · {PAYMENT_METHOD_LABEL[p.method]}
                </span>
                <span className="text-foreground">{formatBRL(p.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Dialog
        open={charging}
        onClose={() => setCharging(false)}
        title="Lançar consumo"
        className="max-w-xl"
      >
        {charging && (
          <ChargeForm
            items={sellable}
            fixedBookingId={bookingId}
            onDone={() => setCharging(false)}
          />
        )}
      </Dialog>

      <Dialog
        open={paying}
        onClose={() => setPaying(false)}
        title="Pagamento do consumo"
        description={`Falta pagar ${formatBRL(summary.balance)}.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPaying(false)}>
              Cancelar
            </Button>
            <Button disabled={pending} onClick={() => void pay()}>
              {pending ? 'Registrando…' : 'Registrar'}
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
              Valor (R$)
            </span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="border-input bg-card rounded-xl border px-3.5 py-2.5 text-sm outline-none"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
              Forma
            </span>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as ConsumptionPayment['method'])}
              className="border-input bg-card rounded-xl border px-3.5 py-2.5 text-sm outline-none"
            >
              {Object.entries(PAYMENT_METHOD_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        </div>
        {error && (
          <p role="alert" className="text-destructive mt-3 text-sm font-medium">
            {error}
          </p>
        )}
      </Dialog>
    </div>
  )
}
