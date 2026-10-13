'use client'

import { useState, type ComponentProps } from 'react'
import Link from 'next/link'
import { Star } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { SearchField } from '@/components/ui/search-field'
import { calculateBookingPrice } from '@/features/reservas/pricing'
import { isoDateInTimeZone } from '@/lib/dates'
import { formatBRL, formatPrice } from '@/lib/format'
import { cn } from '@/lib/utils'

export type BookableRoomInfo = {
  name: string
  description: string
  nightly: number
  capacity: number
}

function addDays(date: string, days: number): string {
  const next = new Date(`${date}T00:00:00Z`)
  next.setUTCDate(next.getUTCDate() + days)
  return next.toISOString().slice(0, 10)
}

/** Hoje em Brasília: em UTC a data do site virava a de amanhã às 21h. */
function todayIso(): string {
  return isoDateInTimeZone(new Date())
}

function isIsoDate(value?: string): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value))
}

function toInitialGuests(value?: string): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : 2
}

/**
 * Card de reserva (fixo ao rolar no desktop, no meio do conteúdo no celular)
 * e a barra "Reservar agora" presa ao pé da tela no celular — o caminho até a
 * reserva fica sempre ao alcance do polegar. Os dois usam o mesmo estado de
 * datas e hóspedes.
 */
export function PousadaBooking({
  slug,
  rating,
  room,
  initialBooking,
  bookingOrigin,
}: {
  slug: string
  rating: number
  room: BookableRoomInfo | null
  initialBooking?: { checkin?: string; checkout?: string; guests?: string }
  bookingOrigin?: 'link_bio'
}) {
  const [checkin, setCheckin] = useState(() => {
    const fallback = addDays(todayIso(), 1)
    return isIsoDate(initialBooking?.checkin) && initialBooking.checkin >= todayIso()
      ? initialBooking.checkin
      : fallback
  })
  const [checkout, setCheckout] = useState(() => {
    const fallback = addDays(checkin, 2)
    return isIsoDate(initialBooking?.checkout) && initialBooking.checkout > checkin
      ? initialBooking.checkout
      : fallback
  })
  const [guests, setGuests] = useState(() => toInitialGuests(initialBooking?.guests))

  const nightly = room?.nightly ?? 0
  const capacity = room?.capacity ?? 1
  const price = calculateBookingPrice(nightly, checkin, checkout)
  const canReserve = Boolean(room) && price.nights > 0 && guests >= 1 && guests <= capacity
  const href = {
    pathname: `/pousada/${slug}/reservar`,
    query: { checkin, checkout, guests, ...(bookingOrigin ? { origem: bookingOrigin } : {}) },
  }
  const reserveClass = cn(
    buttonVariants({ variant: 'accent', size: 'pill-lg' }),
    !canReserve && 'bg-muted text-muted-foreground pointer-events-none',
  )

  return (
    <>
      <div id="reservar" className="bg-card shadow-floating scroll-mt-4 rounded-3xl p-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <span className="text-foreground text-2xl font-semibold tabular-nums">
              {room ? formatPrice(nightly) : 'Indisponível'}
            </span>
            {room && <span className="text-muted-foreground text-sm"> / diária</span>}
          </div>
          <span className="text-foreground inline-flex items-center gap-1 text-sm font-semibold tabular-nums">
            <Star className="fill-ipe text-ipe size-4" />
            {rating.toFixed(1)}
          </span>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <SearchField
            label="Check-in"
            id="reserva-checkin"
            type="date"
            value={checkin}
            min={todayIso()}
            onChange={(event) => {
              const nextCheckin = event.target.value
              setCheckin(nextCheckin)
              if (checkout <= nextCheckin) setCheckout(addDays(nextCheckin, 1))
            }}
          />
          <SearchField
            label="Check-out"
            id="reserva-checkout"
            type="date"
            value={checkout}
            min={addDays(checkin, 1)}
            onChange={(event) => setCheckout(event.target.value)}
          />
          <div className="col-span-2">
            <SearchField
              label="Hóspedes"
              id="reserva-hospedes"
              type="number"
              value={guests}
              min={1}
              max={capacity}
              onChange={(event) => setGuests(Number(event.target.value))}
            />
          </div>
        </div>

        <ReserveAction
          href={href}
          enabled={canReserve}
          className={cn(reserveClass, 'mt-4 w-full')}
        />
        <p className="text-muted-foreground mt-2 text-center text-sm">
          Você ainda não será cobrado
        </p>

        {room && (
          <div className="mt-5 space-y-2 text-sm">
            <div className="text-muted-foreground flex justify-between tabular-nums">
              <span>
                {formatBRL(nightly)} × {price.nights} {price.nights === 1 ? 'noite' : 'noites'}
              </span>
              <span>{formatBRL(price.subtotal)}</span>
            </div>
            <div className="border-border text-foreground flex justify-between border-t pt-3 text-base font-semibold tabular-nums">
              <span>Total</span>
              <span>{formatBRL(price.total)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Celular: barra presa ao pé da tela com o preço e o botão Ipê. */}
      <div
        data-bottom-bar
        className="fixed inset-x-3 bottom-3 z-40 pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <div className="bg-breu/90 border-neblina/10 text-primary-foreground shadow-premium flex items-center justify-between gap-3 rounded-full border py-2 pr-2 pl-5 backdrop-blur-md">
          <span className="flex min-w-0 flex-col">
            <span className="text-pedra text-sm">
              <strong className="text-primary-foreground text-lg font-semibold tabular-nums">
                {room ? formatPrice(nightly) : 'Indisponível'}
              </strong>
              {room && ' / diária'}
            </span>
            <span className="text-liquen truncate text-xs">Você ainda não será cobrado</span>
          </span>
          <ReserveAction
            href={href}
            enabled={canReserve}
            className={cn(reserveClass, 'shrink-0')}
          />
        </div>
      </div>
    </>
  )
}

/**
 * "Reservar agora": link de verdade quando dá para reservar; sem acomodação
 * disponível vira texto desativado (fora do Tab e sem Enter levando adiante).
 */
function ReserveAction({
  href,
  enabled,
  className,
}: {
  href: ComponentProps<typeof Link>['href']
  enabled: boolean
  className: string
}) {
  if (!enabled) {
    return (
      <span aria-disabled="true" className={className}>
        Reservar agora
      </span>
    )
  }
  return (
    <Link href={href} className={className}>
      Reservar agora
    </Link>
  )
}
