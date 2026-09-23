'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { registerManualPaymentAction } from '../../actions'
import { MANUAL_PAYMENT_METHODS, MANUAL_PAYMENT_METHOD_LABEL } from '../../folio'
import { registerPaymentSchema, type RegisterPaymentInput } from '../../folio-schemas'

/** Pagamento feito na pousada. O valor sugerido é o saldo; pode ser parcial (sinal). */
export function RegisterPaymentForm({
  bookingId,
  balanceDue,
}: {
  bookingId: string
  balanceDue: number
}) {
  const router = useRouter()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RegisterPaymentInput>({
    resolver: zodResolver(registerPaymentSchema),
    defaultValues: { bookingId, method: 'pix', amount: balanceDue, notes: '' },
  })

  async function onSubmit(values: RegisterPaymentInput) {
    setFormError(null)
    const result = await registerManualPaymentAction(values)
    if (!result.ok) {
      setFormError(result.error)
      return
    }
    reset({ bookingId, method: values.method, amount: undefined, notes: '' })
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3" noValidate>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="payment-method"
            className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase"
          >
            Forma
          </label>
          <select
            id="payment-method"
            className="border-input bg-card text-foreground focus:border-ring focus:ring-ring/20 rounded-xl border px-3.5 py-2.5 text-sm transition-colors outline-none focus:ring-3"
            {...register('method')}
          >
            {MANUAL_PAYMENT_METHODS.map((method) => (
              <option key={method} value={method}>
                {MANUAL_PAYMENT_METHOD_LABEL[method]}
              </option>
            ))}
          </select>
        </div>
        <Input
          label="Valor (R$)"
          type="number"
          min={0.01}
          step={0.01}
          error={errors.amount?.message}
          {...register('amount')}
        />
      </div>
      <Input
        label="Observação (opcional)"
        placeholder="Ex.: pago na saída"
        error={errors.notes?.message}
        {...register('notes')}
      />
      {formError && <p className="text-destructive text-sm font-medium">{formError}</p>}
      <Button type="submit" size="sm" disabled={isSubmitting}>
        <Wallet className="size-4" />
        {isSubmitting ? 'Registrando…' : 'Registrar pagamento'}
      </Button>
    </form>
  )
}
