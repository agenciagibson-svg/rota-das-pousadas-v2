'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { createBookingSchema, type CreateBookingInput } from '../schemas'
import { createBookingAction } from '../actions'
import { calculateBookingPrice } from '../pricing'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export function BookingForm({
  pousadaSlug,
  nightly,
  capacity,
  initialCheckin = '',
  initialCheckout = '',
  initialGuests,
}: {
  pousadaSlug: string
  nightly: number
  capacity: number
  initialCheckin?: string
  initialCheckout?: string
  initialGuests?: string
}) {
  const router = useRouter()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateBookingInput>({
    resolver: zodResolver(createBookingSchema),
    defaultValues: {
      pousadaSlug,
      expectedNightly: nightly,
      checkin: initialCheckin,
      checkout: initialCheckout,
      guests: Number(initialGuests) || 2,
    },
  })

  const checkin = watch('checkin')
  const checkout = watch('checkout')
  const price = checkin && checkout ? calculateBookingPrice(nightly, checkin, checkout) : null

  async function onSubmit(values: CreateBookingInput) {
    setFormError(null)
    const result = await createBookingAction(values)
    if (!result.ok) {
      setFormError(result.error)
      return
    }
    router.push(result.data.redirectTo)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <input type="hidden" {...register('pousadaSlug')} />

      <div className="grid grid-cols-2 gap-3">
        <Input label="Check-in" type="date" error={errors.checkin?.message} {...register('checkin')} />
        <Input label="Check-out" type="date" error={errors.checkout?.message} {...register('checkout')} />
      </div>
      <Input
        label={`Hóspedes (máx. ${capacity})`}
        type="number"
        min={1}
        max={capacity}
        error={errors.guests?.message}
        {...register('guests')}
      />

      {price && price.nights > 0 && (
        <div className="space-y-2 rounded-2xl border border-border bg-secondary/40 p-4 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>
              R$ {nightly} × {price.nights} {price.nights === 1 ? 'noite' : 'noites'}
            </span>
            <span>R$ {price.subtotal}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Taxa de serviço</span>
            <span>R$ {price.fee}</span>
          </div>
          <div className="flex justify-between border-t border-border pt-2 text-base font-semibold text-foreground">
            <span>Total</span>
            <span>R$ {price.total}</span>
          </div>
        </div>
      )}

      {formError && <p className="text-sm font-medium text-destructive">{formError}</p>}

      <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">
        {isSubmitting ? 'Confirmando…' : 'Confirmar reserva'}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Você ainda não será cobrado — o pagamento será solicitado na próxima etapa.
      </p>
    </form>
  )
}
