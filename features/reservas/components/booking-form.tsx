'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { createBookingSchema, type CreateBookingInput } from '../schemas'
import { createBookingAction } from '../actions'
import { updateMyNameAction } from '@/features/auth/actions'
import { calculateBookingPrice } from '../pricing'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { formatBRL } from '@/lib/format'

/** Mesma mensagem de `bookings.service.ts` (`createBooking`) — usada para decidir
 * quando trocar o erro genérico pelo mini-formulário de completar o nome. */
const MISSING_NAME_ERROR = 'Complete seu nome no cadastro antes de reservar.'

export function BookingForm({
  pousadaSlug,
  nightly,
  capacity,
  initialCheckin = '',
  initialCheckout = '',
  initialGuests,
  origin,
}: {
  pousadaSlug: string
  nightly: number
  capacity: number
  initialCheckin?: string
  initialCheckout?: string
  initialGuests?: string
  /** `link_bio` quando o hóspede chegou pelo link da bio — vai junto na reserva. */
  origin?: 'link_bio'
}) {
  const router = useRouter()
  const [formError, setFormError] = useState<string | null>(null)
  const [nameValue, setNameValue] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [savingName, setSavingName] = useState(false)
  const {
    register,
    handleSubmit,
    watch,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<CreateBookingInput>({
    resolver: zodResolver(createBookingSchema),
    defaultValues: {
      pousadaSlug,
      expectedNightly: nightly,
      checkin: initialCheckin,
      checkout: initialCheckout,
      guests: Number(initialGuests) || 2,
      origin,
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

  /** Salva o nome que faltava e tenta a reserva de novo, sem o hóspede precisar clicar duas vezes. */
  async function handleSaveName() {
    setNameError(null)
    if (nameValue.trim().length < 2) {
      setNameError('Informe seu nome completo.')
      return
    }
    setSavingName(true)
    const result = await updateMyNameAction({ name: nameValue.trim() })
    setSavingName(false)
    if (!result.ok) {
      setNameError(result.error)
      return
    }
    router.refresh()
    await onSubmit(getValues())
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <input type="hidden" {...register('pousadaSlug')} />

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Check-in"
          type="date"
          error={errors.checkin?.message}
          {...register('checkin')}
        />
        <Input
          label="Check-out"
          type="date"
          error={errors.checkout?.message}
          {...register('checkout')}
        />
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
        <div className="border-border bg-secondary/40 space-y-2 rounded-2xl border p-4 text-sm">
          <div className="text-muted-foreground flex justify-between">
            <span>
              {formatBRL(nightly)} × {price.nights} {price.nights === 1 ? 'noite' : 'noites'}
            </span>
            <span>{formatBRL(price.subtotal)}</span>
          </div>
          <div className="border-border text-foreground flex justify-between border-t pt-2 text-base font-semibold">
            <span>Total</span>
            <span>{formatBRL(price.total)}</span>
          </div>
        </div>
      )}

      {formError === MISSING_NAME_ERROR ? (
        <div className="border-destructive/30 bg-destructive/5 space-y-3 rounded-2xl border p-4">
          <p className="text-destructive text-sm font-medium">{formError}</p>
          <Input
            label="Seu nome completo"
            placeholder="Como você quer ser identificado na reserva"
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            error={nameError ?? undefined}
          />
          <Button
            type="button"
            variant="secondary"
            disabled={savingName}
            onClick={handleSaveName}
            className="w-full"
          >
            {savingName ? 'Salvando…' : 'Salvar nome e continuar'}
          </Button>
        </div>
      ) : (
        formError && <p className="text-destructive text-sm font-medium">{formError}</p>
      )}

      <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">
        {isSubmitting ? 'Confirmando…' : 'Confirmar reserva'}
      </Button>
      <p className="text-muted-foreground text-center text-xs">
        Você ainda não será cobrado — o pagamento será solicitado na próxima etapa.
      </p>
      <p className="text-muted-foreground text-center text-xs">
        Ao confirmar, você aceita os{' '}
        <Link href="/termos" target="_blank" className="text-primary underline">
          Termos de Uso
        </Link>{' '}
        e a pousada recebe os dados do seu cadastro para a ficha de hospedagem (
        <Link href="/privacidade" target="_blank" className="text-primary underline">
          Privacidade
        </Link>
        ).
      </p>
    </form>
  )
}
