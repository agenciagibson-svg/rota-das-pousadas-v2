'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'motion/react'
import {
  Star,
  MapPin,
  Share2,
  ChevronLeft,
  ChevronRight,
  Users,
  Quote,
  Camera,
  AtSign,
  Clock3,
  ClipboardList,
  ShieldCheck,
  Phone,
  MessageCircle,
  Navigation,
} from 'lucide-react'
import { isoDateInTimeZone } from '@/lib/dates'
import type { Pousada } from '@/lib/data'
import { Reveal } from '@/components/reveal'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { calculateBookingPrice } from '@/features/reservas/pricing'
import { FavoriteButton } from './favorite-button'

/** Avaliação pública (sem nome do autor — ver `reviews.repository.ts::listPublicReviewsByPousada`). */
type PublicReview = {
  id: string
  rating: number
  text: string
  response: string | null
  createdAt: string
}

function formatReviewDate(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso))
}

/** Dígitos puros de um telefone BR ("(34) 99999-0000" -> "34999990000"). */
function onlyDigits(value: string): string {
  return value.replace(/\D/g, '')
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

export type BookableRoomInfo = {
  name: string
  description: string
  nightly: number
  capacity: number
}

export function PousadaDetail({
  pousada,
  room,
  reviews,
  initialBooking,
  favorite,
  isLoggedIn,
  bookingOrigin,
}: {
  pousada: Pousada
  room: BookableRoomInfo | null
  reviews: PublicReview[]
  initialBooking?: { checkin?: string; checkout?: string; guests?: string }
  favorite: boolean
  isLoggedIn: boolean
  /** `link_bio` quando a visita veio do link da bio — segue para a página de reserva. */
  bookingOrigin?: 'link_bio'
}) {
  const [active, setActive] = useState(0)
  const [shared, setShared] = useState(false)
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
  const gallery = pousada.gallery.length ? pousada.gallery : [pousada.image || '/placeholder.svg']
  const activeImage = gallery[active] || gallery[0] || '/placeholder.svg'

  function showPreviousImage() {
    setActive((current) => (current === 0 ? gallery.length - 1 : current - 1))
  }

  function showNextImage() {
    setActive((current) => (current === gallery.length - 1 ? 0 : current + 1))
  }

  async function handleShare() {
    const shareData = {
      title: pousada.name,
      text: `Confira ${pousada.name} na Rota das Pousadas`,
      url: typeof window !== 'undefined' ? window.location.href : '',
    }
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share(shareData)
        return
      }
      if (typeof navigator !== 'undefined' && navigator.clipboard && shareData.url) {
        await navigator.clipboard.writeText(shareData.url)
        setShared(true)
        setTimeout(() => setShared(false), 2000)
      }
    } catch {
      // Usuário cancelou o compartilhamento nativo — não é erro.
    }
  }

  const mapsUrl = pousada.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${pousada.address}, ${pousada.city} - ${pousada.state}`)}`
    : null
  const whatsappDigits = pousada.whatsapp ? onlyDigits(pousada.whatsapp) : ''
  const phoneDigits = pousada.contactPhone ? onlyDigits(pousada.contactPhone) : ''

  return (
    <div className="pb-24">
      <section className="mx-auto max-w-7xl px-5 pt-28 lg:px-8">
        <div className="border-border bg-card overflow-hidden rounded-3xl border">
          <div className="relative aspect-[16/10] min-h-[320px] overflow-hidden md:aspect-[21/9] md:min-h-[520px]">
            <Image
              src={activeImage}
              alt={`${pousada.name} - foto ${active + 1}`}
              fill
              sizes="100vw"
              className="object-cover"
              priority
            />
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 bg-gradient-to-t from-black/65 to-transparent p-4 text-white md:p-6">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">
                  <Camera className="size-3.5" />
                  {active + 1} de {gallery.length}
                </span>
                <h2 className="mt-3 font-serif text-2xl font-semibold md:text-4xl">
                  {pousada.name}
                </h2>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={showPreviousImage}
                  aria-label="Foto anterior"
                  className="text-foreground flex size-11 items-center justify-center rounded-full bg-white/90 shadow-sm transition-colors hover:bg-white"
                >
                  <ChevronLeft className="size-5" />
                </button>
                <button
                  type="button"
                  onClick={showNextImage}
                  aria-label="Próxima foto"
                  className="text-foreground flex size-11 items-center justify-center rounded-full bg-white/90 shadow-sm transition-colors hover:bg-white"
                >
                  <ChevronRight className="size-5" />
                </button>
              </div>
            </div>
          </div>
          <div className="flex gap-3 overflow-x-auto p-3">
            {gallery.map((img, index) => (
              <button
                key={`${img}-${index}`}
                type="button"
                onClick={() => setActive(index)}
                aria-label={`Abrir foto ${index + 1}`}
                className={`relative h-20 w-28 shrink-0 overflow-hidden rounded-xl border transition-all ${
                  active === index
                    ? 'border-primary ring-primary/20 ring-2'
                    : 'border-border opacity-75 hover:opacity-100'
                }`}
              >
                <Image
                  src={img || '/placeholder.svg'}
                  alt={`${pousada.name} miniatura ${index + 1}`}
                  fill
                  sizes="112px"
                  className="object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Header */}
      <section className="mx-auto max-w-7xl px-5 pt-8 lg:px-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {pousada.tags.map((t) => (
                <Badge key={t} variant="secondary" size="md">
                  {t}
                </Badge>
              ))}
            </div>
            <h1 className="text-foreground mt-4 font-serif text-3xl font-semibold sm:text-5xl">
              {pousada.name}
            </h1>
            <div className="text-muted-foreground mt-3 flex flex-wrap items-center gap-4 text-sm">
              <span className="text-foreground inline-flex items-center gap-1.5 font-semibold">
                <Star className="fill-gold text-gold size-4" />
                {pousada.rating.toFixed(1)}
                <span className="text-muted-foreground font-normal">
                  ({pousada.reviews} avaliações)
                </span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-4" />
                {pousada.city}, {pousada.state}
              </span>
              {pousada.instagram && (
                <a
                  href={pousada.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground hover:text-primary inline-flex items-center gap-1.5 font-semibold"
                >
                  <AtSign className="size-4" />
                  Instagram
                </a>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleShare}
              className="border-border text-foreground hover:bg-secondary inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition-colors"
            >
              <Share2 className="size-4" />
              {shared ? 'Link copiado!' : 'Compartilhar'}
            </button>
            <FavoriteButton
              slug={pousada.slug}
              initialFavorite={favorite}
              isLoggedIn={isLoggedIn}
            />
          </div>
        </div>
      </section>

      {/* Content grid */}
      <section className="mx-auto mt-10 grid max-w-7xl gap-12 px-5 lg:grid-cols-[1.6fr_1fr] lg:px-8">
        <div className="min-w-0">
          {/* Description */}
          <Reveal>
            <div className="border-border border-b pb-10">
              <h2 className="text-foreground font-serif text-2xl font-semibold">Sobre o refúgio</h2>
              <p className="text-muted-foreground mt-4 leading-relaxed text-pretty">
                {pousada.description}
              </p>
            </div>
          </Reveal>

          {/* Rooms */}
          <Reveal>
            <div className="border-border border-b py-10">
              <h2 className="text-foreground font-serif text-2xl font-semibold">
                Quartos & acomodações
              </h2>
              <div className="mt-6">
                {room ? (
                  <div className="border-primary bg-primary/5 flex w-full items-center justify-between rounded-2xl border p-4 text-left">
                    <div>
                      <h3 className="text-foreground font-semibold">{room.name}</h3>
                      {room.description && (
                        <p className="text-muted-foreground mt-0.5 text-sm">{room.description}</p>
                      )}
                      <p className="text-muted-foreground mt-1 text-xs">
                        até {room.capacity} hóspedes
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-foreground font-semibold">R$ {room.nightly}</div>
                      <div className="text-muted-foreground text-xs">/ diária</div>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    Nenhuma acomodação disponível no momento.
                  </p>
                )}
              </div>
            </div>
          </Reveal>

          {/* Informações importantes */}
          {(pousada.checkinTime ||
            pousada.checkoutTime ||
            pousada.houseRules ||
            pousada.cancellationPolicy ||
            whatsappDigits ||
            phoneDigits) && (
            <Reveal>
              <div className="border-border border-b py-10">
                <h2 className="text-foreground font-serif text-2xl font-semibold">
                  Informações importantes
                </h2>
                <div className="mt-6 grid gap-6 sm:grid-cols-2">
                  {(pousada.checkinTime || pousada.checkoutTime) && (
                    <div className="flex items-start gap-3">
                      <Clock3 className="text-primary mt-0.5 size-5 shrink-0" />
                      <div className="text-sm">
                        <div className="text-foreground font-semibold">Check-in e check-out</div>
                        <p className="text-muted-foreground mt-1">
                          Check-in a partir das {pousada.checkinTime || '—'} · check-out até{' '}
                          {pousada.checkoutTime || '—'}
                        </p>
                      </div>
                    </div>
                  )}
                  {pousada.cancellationPolicy && (
                    <div className="flex items-start gap-3">
                      <ShieldCheck className="text-primary mt-0.5 size-5 shrink-0" />
                      <div className="text-sm">
                        <div className="text-foreground font-semibold">
                          Política de cancelamento
                        </div>
                        <p className="text-muted-foreground mt-1 text-pretty">
                          {pousada.cancellationPolicy}
                        </p>
                      </div>
                    </div>
                  )}
                  {pousada.houseRules && (
                    <div className="flex items-start gap-3">
                      <ClipboardList className="text-primary mt-0.5 size-5 shrink-0" />
                      <div className="text-sm">
                        <div className="text-foreground font-semibold">Regras da casa</div>
                        <p className="text-muted-foreground mt-1 text-pretty">
                          {pousada.houseRules}
                        </p>
                      </div>
                    </div>
                  )}
                  {(whatsappDigits || phoneDigits) && (
                    <div className="flex items-start gap-3">
                      <Phone className="text-primary mt-0.5 size-5 shrink-0" />
                      <div className="text-sm">
                        <div className="text-foreground font-semibold">Fale com a pousada</div>
                        <div className="mt-1 flex flex-wrap gap-3">
                          {whatsappDigits && (
                            <a
                              href={`https://wa.me/55${whatsappDigits}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-foreground hover:text-primary inline-flex items-center gap-1.5 font-semibold"
                            >
                              <MessageCircle className="size-4" />
                              WhatsApp
                            </a>
                          )}
                          {phoneDigits && (
                            <a
                              href={`tel:+55${phoneDigits}`}
                              className="text-foreground hover:text-primary inline-flex items-center gap-1.5 font-semibold"
                            >
                              <Phone className="size-4" />
                              {pousada.contactPhone}
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Reveal>
          )}

          {/* Reviews */}
          <Reveal>
            <div className="border-border border-b py-10">
              <div className="flex items-center gap-3">
                <h2 className="text-foreground font-serif text-2xl font-semibold">Avaliações</h2>
                <span className="bg-secondary text-foreground inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold">
                  <Star className="fill-gold text-gold size-4" />
                  {pousada.rating.toFixed(1)}
                </span>
              </div>
              {reviews.length > 0 ? (
                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                  {reviews.map((r) => (
                    <Card key={r.id} className="p-5">
                      <Quote className="text-primary/30 size-6" />
                      <p className="text-foreground mt-3 text-sm leading-relaxed">{r.text}</p>
                      <div className="text-gold mt-4 flex items-center gap-1">
                        {Array.from({ length: r.rating }).map((_, i) => (
                          <Star key={i} className="fill-gold size-3.5" />
                        ))}
                      </div>
                      <div className="text-muted-foreground mt-3 text-xs">
                        {formatReviewDate(r.createdAt)}
                      </div>
                      {r.response && (
                        <div className="bg-secondary/60 text-muted-foreground mt-3 rounded-xl p-3 text-xs">
                          <span className="text-foreground font-semibold">
                            Resposta da pousada:{' '}
                          </span>
                          {r.response}
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground mt-6 text-sm">
                  Ainda sem avaliações públicas por aqui — as primeiras aparecem depois que um
                  hóspede avalia a estadia.
                </p>
              )}
            </div>
          </Reveal>

          {/* Location */}
          <Reveal>
            <div className="py-10">
              <h2 className="text-foreground font-serif text-2xl font-semibold">Localização</h2>
              <div className="border-border bg-secondary/40 mt-6 flex flex-col items-start justify-between gap-4 rounded-2xl border p-5 sm:flex-row sm:items-center">
                <div className="flex items-start gap-3 text-sm">
                  <MapPin className="text-primary mt-0.5 size-5 shrink-0" />
                  <div>
                    <div className="text-foreground font-semibold">
                      {pousada.city}, {pousada.state}
                    </div>
                    {pousada.address && (
                      <div className="text-muted-foreground mt-0.5">{pousada.address}</div>
                    )}
                  </div>
                </div>
                {mapsUrl && (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border-border text-foreground hover:bg-secondary inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition-colors"
                  >
                    <Navigation className="size-4" />
                    Ver no mapa
                  </a>
                )}
              </div>
            </div>
          </Reveal>
        </div>

        {/* Booking card */}
        <div className="order-first lg:relative lg:order-none">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="border-border bg-card shadow-stone-deep/5 rounded-3xl border p-6 shadow-xl lg:sticky lg:top-24"
          >
            <div className="flex items-end justify-between">
              <div>
                <span className="text-foreground text-2xl font-semibold">
                  {room ? `R$ ${nightly}` : 'Indisponível'}
                </span>
                {room && <span className="text-muted-foreground text-sm"> / diária</span>}
              </div>
              <span className="text-foreground inline-flex items-center gap-1 text-sm font-semibold">
                <Star className="fill-gold text-gold size-4" />
                {pousada.rating.toFixed(1)}
              </span>
            </div>

            <div className="border-border mt-5 overflow-hidden rounded-2xl border">
              <div className="divide-border border-border grid grid-cols-2 divide-x border-b">
                <label className="block p-3">
                  <span className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
                    Check-in
                  </span>
                  <input
                    type="date"
                    value={checkin}
                    min={todayIso()}
                    onChange={(event) => {
                      const nextCheckin = event.target.value
                      setCheckin(nextCheckin)
                      if (checkout <= nextCheckin) setCheckout(addDays(nextCheckin, 1))
                    }}
                    className="text-foreground mt-1 w-full bg-transparent text-sm font-medium outline-none"
                  />
                </label>
                <label className="block p-3">
                  <span className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
                    Check-out
                  </span>
                  <input
                    type="date"
                    value={checkout}
                    min={addDays(checkin, 1)}
                    onChange={(event) => setCheckout(event.target.value)}
                    className="text-foreground mt-1 w-full bg-transparent text-sm font-medium outline-none"
                  />
                </label>
              </div>
              <div className="flex items-center justify-between p-3">
                <label className="min-w-0 flex-1">
                  <span className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
                    Hóspedes
                  </span>
                  <input
                    type="number"
                    value={guests}
                    min={1}
                    max={capacity}
                    onChange={(event) => setGuests(Number(event.target.value))}
                    className="text-foreground mt-1 w-full bg-transparent text-sm font-medium outline-none"
                  />
                </label>
                <Users className="text-muted-foreground size-4" />
              </div>
            </div>

            <Link
              href={{
                pathname: `/pousada/${pousada.slug}/reservar`,
                query: {
                  checkin,
                  checkout,
                  guests,
                  ...(bookingOrigin ? { origem: bookingOrigin } : {}),
                },
              }}
              aria-disabled={!canReserve}
              className={`mt-4 block w-full rounded-2xl py-3.5 text-center text-sm font-semibold transition-all ${
                canReserve
                  ? 'bg-accent text-accent-foreground hover:brightness-105'
                  : 'bg-muted text-muted-foreground pointer-events-none'
              }`}
            >
              Reservar agora
            </Link>
            <p className="text-muted-foreground mt-2 text-center text-xs">
              Você ainda não será cobrado
            </p>

            {room && (
              <div className="mt-5 space-y-2 text-sm">
                <div className="text-muted-foreground flex justify-between">
                  <span>
                    R$ {nightly} × {price.nights} {price.nights === 1 ? 'noite' : 'noites'}
                  </span>
                  <span>R$ {price.subtotal}</span>
                </div>
                <div className="border-border text-foreground flex justify-between border-t pt-3 text-base font-semibold">
                  <span>Total</span>
                  <span>R$ {price.total}</span>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </section>
    </div>
  )
}
