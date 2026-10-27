'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import '@/lib/validation/zod-pt'
import { useRouter } from 'next/navigation'
import { createBookingSchema, type CreateBookingInput } from '../schemas'
import { createBookingAction } from '../actions'
import { updateMyNameAction } from '@/features/auth/actions'
import type { StayQuote } from '../pricing'
import { StayPriceSummary, quoteAllowsBooking } from './stay-price-summary'
import { useStayQuote } from './use-stay-quote'
import { PriceCalendar } from './price-calendar'
import { isoDateInTimeZone } from '@/lib/dates'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { CouponField } from '@/features/cupons/components/coupon-field'
import { useCoupon } from '@/features/cupons/components/use-coupon'

/** Mesma mensagem de `bookings.service.ts` (`createBooking`) — usada para decidir
 * quando trocar o erro genérico pelo mini-formulário de completar o nome. */
const MISSING_NAME_ERROR = 'Complete seu nome no cadastro antes de reservar.'

export function BookingForm({
  pousadaSlug,
  nightly,
  capacity,
  quote,
  roomId,
  calendarRoomId,
  initialCheckin = '',
  initialCheckout = '',
  initialGuests,
  origin,
  initialCoupon,
}: {
  pousadaSlug: string
  nightly: number
  capacity: number
  /** Cotação do servidor para as datas da URL (0087). */
  quote: StayQuote | null
  /** Acomodação escolhida antes (ex.: na página da bio). */
  roomId?: string
  /**
   * Acomodação que o calendário com preço considera. Só quando a pessoa
   * escolheu uma (bio); sem ela o calendário mostra o "a partir de" de todas.
   */
  calendarRoomId?: string
  initialCheckin?: string
  initialCheckout?: string
  initialGuests?: string
  /** `link_bio` quando o hóspede chegou pelo link da bio — vai junto na reserva. */
  origin?: 'link_bio'
  /** Cupom vindo da bio (`?cupom=`, 0100): já aparece preenchido e é aplicado. */
  initialCoupon?: string
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
    setValue,
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
      roomId,
    },
  })

  const checkin = watch('checkin')
  const checkout = watch('checkout')
  const guests = Number(watch('guests')) || 1
  const { calculating } = useStayQuote({
    checkin,
    checkout,
    guests,
    quote,
    hrefFor: (q) => {
      const params = new URLSearchParams({
        checkin: q.checkin,
        checkout: q.checkout,
        guests: String(q.guests),
      })
      if (roomId) params.set('quarto', roomId)
      if (origin) params.set('origem', origin)
      return `/pousada/${pousadaSlug}/reservar?${params.toString()}`
    },
  })
  const canSubmit = quoteAllowsBooking(quote, checkin, checkout)
  const coupon = useCoupon({
    roomId,
    checkin,
    checkout,
    ready: canSubmit,
    initialCode: initialCoupon,
  })

  async function onSubmit(values: CreateBookingInput) {
    setFormError(null)
    if (!quote || !quoteAllowsBooking(quote, values.checkin, values.checkout)) {
      setFormError('Aguarde o valor dessas datas aparecer para confirmar.')
      return
    }
    if (coupon.applying) {
      setFormError('Aguarde o cupom ser conferido.')
      return
    }
    if (coupon.pendingCode) {
      setFormError('Toque em "Aplicar" para usar o cupom, ou remova o código.')
      return
    }
    // O desconto é recalculado e validado no banco; `expectedDiscount` só
    // garante que a reserva não nasce com um valor diferente do que a tela mostrou.
    const result = await createBookingAction({
      ...values,
      roomId,
      expectedTotal: quote.total,
      couponCode: coupon.applied?.code,
      expectedDiscount: coupon.applied?.discount,
    })
    if (!result.ok) {
      setFormError(result.error)
      // O cupom pode ter mudado (esgotou, outro valor): confere de novo.
      if (coupon.applied) void coupon.refresh()
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
      <PriceCalendar
        slug={pousadaSlug}
        guests={guests}
        roomId={calendarRoomId}
        today={isoDateInTimeZone(new Date())}
        checkin={checkin}
        checkout={checkout}
        onChange={(selection) => {
          setValue('checkin', selection.checkin, { shouldValidate: Boolean(errors.checkin) })
          setValue('checkout', selection.checkout, { shouldValidate: Boolean(errors.checkout) })
        }}
      />
      <Input
        label={`Hóspedes (máx. ${capacity})`}
        type="number"
        min={1}
        max={capacity}
        error={errors.guests?.message}
        {...register('guests')}
      />

      <StayPriceSummary
        nightly={nightly}
        quote={quote}
        checkin={checkin}
        checkout={checkout}
        calculating={calculating}
      />

      <CouponField coupon={coupon} />

      {formError === MISSING_NAME_ERROR ? (
        <div className="border-destructive/30 bg-destructive/5 space-y-3 rounded-2xl border p-4">
          <p role="alert" className="text-destructive text-sm font-medium">
            {formError}
          </p>
          <Input
            id="reserva-nome"
            name="name"
            autoComplete="name"
            label="Seu nome completo"
            placeholder="Como você quer ser identificado na reserva"
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            error={nameError ?? undefined}
          />
          <Button
            type="button"
            variant="secondary"
            size="pill"
            disabled={savingName}
            onClick={handleSaveName}
            className="w-full"
          >
            {savingName ? 'Salvando…' : 'Salvar nome e continuar'}
          </Button>
        </div>
      ) : (
        formError && (
          <p role="alert" className="text-destructive text-sm font-medium">
            {formError}
          </p>
        )
      )}

      <Button
        type="submit"
        variant="accent"
        size="pill-lg"
        disabled={isSubmitting || !canSubmit}
        className="w-full"
      >
        {isSubmitting ? 'Confirmando…' : 'Confirmar reserva'}
      </Button>
      <p className="text-muted-foreground text-center text-sm">
        Você ainda não será cobrado — o pagamento será solicitado na próxima etapa.
      </p>
      <p className="text-muted-foreground text-center text-sm">
        Ao confirmar, você aceita os{' '}
        <Link
          href="/termos"
          target="_blank"
          className="text-foreground underline underline-offset-2"
        >
          Termos de Uso
        </Link>{' '}
        e a pousada recebe os dados do seu cadastro para a ficha de hospedagem (
        <Link
          href="/privacidade"
          target="_blank"
          className="text-foreground underline underline-offset-2"
        >
          Privacidade
        </Link>
        ).
      </p>
    </form>
  )
}
