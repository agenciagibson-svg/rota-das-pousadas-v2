'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { formatBRL, formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { registerBookingPaymentAction, reverseBookingPaymentAction } from '../actions'
import {
  MANUAL_PAYMENT_METHOD_LABEL,
  bookingPaymentMethodLabel,
  type ManualPaymentMethod,
} from '../booking-payment'
import type { BookingPaymentRow } from '@/repositories/booking-payments.repository'

/** Pagamentos da diária no detalhe da reserva + registrar o que entrou no balcão (0086). */
export function BookingPaymentsPanel({
  bookingId,
  balanceDue,
  acceptsPayment,
  payments,
  canRegister,
  canReverse,
}: {
  bookingId: string
  balanceDue: number
  /** Reserva pendente, confirmada ou em andamento (não cancelada/no-show). */
  acceptsPayment: boolean
  payments: BookingPaymentRow[]
  canRegister: boolean
  canReverse: boolean
}) {
  const router = useRouter()
  const [paying, setPaying] = useState(false)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<ManualPaymentMethod>('dinheiro')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [reversing, setReversing] = useState<BookingPaymentRow | null>(null)
  const [reason, setReason] = useState('')
  const [reverseError, setReverseError] = useState<string | null>(null)

  async function pay() {
    setError(null)
    setPending(true)
    try {
      const res = await registerBookingPaymentAction({
        bookingId,
        amount: amount.replace(',', '.'),
        method,
        note,
      })
      if (!res.ok) {
        setError(res.fieldErrors?.amount ?? res.error)
        return
      }
      setPaying(false)
      setAmount('')
      setNote('')
      router.refresh()
    } catch {
      setError('Não foi possível registrar. Tente de novo.')
    } finally {
      setPending(false)
    }
  }

  async function reverse() {
    if (!reversing) return
    setReverseError(null)
    setPending(true)
    try {
      const res = await reverseBookingPaymentAction({
        bookingId,
        paymentId: reversing.id,
        reason,
      })
      if (!res.ok) {
        setReverseError(res.fieldErrors?.reason ?? res.error)
        return
      }
      setReversing(null)
      setReason('')
      router.refresh()
    } catch {
      setReverseError('Não foi possível estornar. Tente de novo.')
    } finally {
      setPending(false)
    }
  }

  const visible = payments.filter((p) => p.status === 'aprovado' || p.status === 'estornado')

  return (
    <div className="mt-4 border-t pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-foreground text-sm font-semibold">Pagamentos da diária</p>
        {canRegister && acceptsPayment && balanceDue > 0 && (
          <Button
            size="sm"
            onClick={() => {
              setError(null)
              setAmount(balanceDue.toFixed(2))
              setPaying(true)
            }}
          >
            Registrar pagamento
          </Button>
        )}
      </div>

      {visible.length > 0 ? (
        <ul className="mt-2 space-y-1.5 text-sm">
          {visible.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <span className="text-muted-foreground flex flex-wrap items-center gap-2">
                {formatDateTime(p.createdAt)} · {bookingPaymentMethodLabel(p.method)}
                {p.manual && (
                  <Badge variant="outline" size="sm">
                    Balcão
                  </Badge>
                )}
                {p.status === 'estornado' && (
                  <Badge variant="destructiveSoft" size="sm">
                    Estornado
                  </Badge>
                )}
              </span>
              <span className="flex items-center gap-2">
                <span className={cn('text-foreground', p.status === 'estornado' && 'line-through')}>
                  {formatBRL(p.amount)}
                </span>
                {canReverse && p.manual && p.status === 'aprovado' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setReverseError(null)
                      setReason('')
                      setReversing(p)
                    }}
                  >
                    Estornar
                  </Button>
                )}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground mt-2 text-sm">
          Nenhum pagamento registrado.
          {canRegister && acceptsPayment && balanceDue > 0
            ? ' Recebeu no balcão? Use "Registrar pagamento".'
            : ''}
        </p>
      )}

      <Dialog
        open={paying}
        onClose={() => setPaying(false)}
        title="Registrar pagamento da diária"
        description={`Falta receber ${formatBRL(balanceDue)}. Se o saldo zerar, uma reserva pendente é confirmada e o hóspede recebe o e-mail.`}
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
            <span className="text-foreground text-sm font-medium">Valor recebido (R$)</span>
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
            <span className="text-foreground text-sm font-medium">Forma</span>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as ManualPaymentMethod)}
              className="border-input bg-card rounded-xl border px-3.5 py-2.5 text-sm outline-none"
            >
              {Object.entries(MANUAL_PAYMENT_METHOD_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-3">
          <Textarea
            name="payment-note"
            label="Observação (opcional)"
            rows={2}
            maxLength={200}
            placeholder="Ex.: sinal pago na reserva por telefone"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        {error && (
          <p role="alert" className="text-destructive mt-3 text-sm font-medium">
            {error}
          </p>
        )}
      </Dialog>

      <Dialog
        open={reversing !== null}
        onClose={() => setReversing(null)}
        title="Estornar pagamento"
        description={
          reversing
            ? `${formatBRL(reversing.amount)} em ${bookingPaymentMethodLabel(reversing.method)}. O valor volta para "Falta receber" e o estorno fica registrado.`
            : undefined
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setReversing(null)}>
              Voltar
            </Button>
            <Button variant="destructive" disabled={pending} onClick={() => void reverse()}>
              {pending ? 'Estornando…' : 'Estornar pagamento'}
            </Button>
          </>
        }
      >
        <Textarea
          name="reverse-booking-reason"
          label="Motivo do estorno"
          rows={3}
          maxLength={190}
          placeholder="Ex.: valor digitado errado"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          error={reverseError ?? undefined}
        />
      </Dialog>
    </div>
  )
}
