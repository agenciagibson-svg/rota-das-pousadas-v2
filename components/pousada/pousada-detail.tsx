'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'motion/react'
import {
  Star,
  MapPin,
  Share2,
  Wifi,
  Coffee,
  Flame,
  Bath,
  WavesLadder,
  Car,
  PawPrint,
  Wind,
  Mountain,
  BellRing,
  Sparkles,
  Trees,
  ChevronLeft,
  ChevronRight,
  Users,
  Quote,
  Compass,
  Camera,
  AtSign,
} from 'lucide-react'
import type { Pousada } from '@/lib/data'
import { amenities, reviews } from '@/lib/data'
import { Reveal } from '@/components/reveal'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { calculateBookingPrice } from '@/features/reservas/pricing'
import { FavoriteButton } from './favorite-button'

const amenityIcons = [Wifi, Coffee, Flame, Bath, WavesLadder, Car, PawPrint, Wind, Mountain, BellRing, Sparkles, Trees]

function addDays(date: string, days: number): string {
  const next = new Date(`${date}T00:00:00Z`)
  next.setUTCDate(next.getUTCDate() + days)
  return next.toISOString().slice(0, 10)
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
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
  initialBooking,
  favorite,
  isLoggedIn,
}: {
  pousada: Pousada
  room: BookableRoomInfo | null
  initialBooking?: { checkin?: string; checkout?: string; guests?: string }
  favorite: boolean
  isLoggedIn: boolean
}) {
  const [active, setActive] = useState(0)
  const [selectedDay, setSelectedDay] = useState<number | null>(14)
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

  return (
    <div className="pb-24">
      <section className="mx-auto max-w-7xl px-5 pt-28 lg:px-8">
        <div className="overflow-hidden rounded-3xl border border-border bg-card">
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
                <h2 className="mt-3 font-serif text-2xl font-semibold md:text-4xl">{pousada.name}</h2>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={showPreviousImage}
                  aria-label="Foto anterior"
                  className="flex size-11 items-center justify-center rounded-full bg-white/90 text-foreground shadow-sm transition-colors hover:bg-white"
                >
                  <ChevronLeft className="size-5" />
                </button>
                <button
                  type="button"
                  onClick={showNextImage}
                  aria-label="Proxima foto"
                  className="flex size-11 items-center justify-center rounded-full bg-white/90 text-foreground shadow-sm transition-colors hover:bg-white"
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
                  active === index ? 'border-primary ring-2 ring-primary/20' : 'border-border opacity-75 hover:opacity-100'
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
            <h1 className="mt-4 font-serif text-3xl font-semibold text-foreground sm:text-5xl">{pousada.name}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
                <Star className="size-4 fill-gold text-gold" />
                {pousada.rating.toFixed(1)}
                <span className="font-normal text-muted-foreground">({pousada.reviews} avaliações)</span>
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
                  className="inline-flex items-center gap-1.5 font-semibold text-foreground hover:text-primary"
                >
                  <AtSign className="size-4" />
                  Instagram
                </a>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary">
              <Share2 className="size-4" />
              Compartilhar
            </button>
            <FavoriteButton slug={pousada.slug} initialFavorite={favorite} isLoggedIn={isLoggedIn} />
          </div>
        </div>
      </section>

      {/* Content grid */}
      <section className="mx-auto mt-10 grid max-w-7xl gap-12 px-5 lg:grid-cols-[1.6fr_1fr] lg:px-8">
        <div className="min-w-0">
          {/* Description */}
          <Reveal>
            <div className="border-b border-border pb-10">
              <h2 className="font-serif text-2xl font-semibold text-foreground">Sobre o refúgio</h2>
              <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">{pousada.description}</p>
              <div className="mt-6 grid grid-cols-3 gap-4">
                {[
                  { icon: Users, label: 'Até 4 hóspedes' },
                  { icon: Mountain, label: 'Vista para o vale' },
                  { icon: Compass, label: 'Trilhas guiadas' },
                ].map((f) => (
                  <div key={f.label} className="flex flex-col items-center gap-2 rounded-2xl bg-secondary/60 p-4 text-center">
                    <f.icon className="size-6 text-primary" />
                    <span className="text-xs font-medium text-foreground">{f.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          {/* Amenities */}
          <Reveal>
            <div className="border-b border-border py-10">
              <h2 className="font-serif text-2xl font-semibold text-foreground">Comodidades</h2>
              <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
                {amenities.map((a, i) => {
                  const Icon = amenityIcons[i % amenityIcons.length]
                  return (
                    <div key={a} className="flex items-center gap-3 text-sm text-foreground">
                      <Icon className="size-5 shrink-0 text-primary" />
                      {a}
                    </div>
                  )
                })}
              </div>
            </div>
          </Reveal>

          {/* Rooms */}
          <Reveal>
            <div className="border-b border-border py-10">
              <h2 className="font-serif text-2xl font-semibold text-foreground">Quartos & acomodações</h2>
              <div className="mt-6">
                {room ? (
                  <div className="flex w-full items-center justify-between rounded-2xl border border-primary bg-primary/5 p-4 text-left">
                    <div>
                      <h3 className="font-semibold text-foreground">{room.name}</h3>
                      {room.description && (
                        <p className="mt-0.5 text-sm text-muted-foreground">{room.description}</p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">até {room.capacity} hóspedes</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-semibold text-foreground">R$ {room.nightly}</div>
                      <div className="text-xs text-muted-foreground">/ diária</div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhuma acomodação disponível no momento.</p>
                )}
              </div>
            </div>
          </Reveal>

          {/* Calendar */}
          <Reveal>
            <div className="border-b border-border py-10">
              <h2 className="font-serif text-2xl font-semibold text-foreground">Disponibilidade</h2>
              <p className="mt-1 text-sm text-muted-foreground">Selecione seu período em Março de 2026</p>
              <div className="mt-6 max-w-sm">
                <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted-foreground">
                  {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                    <span key={i} className="py-2">{d}</span>
                  ))}
                </div>
                <div className="mt-1 grid grid-cols-7 gap-1">
                  {Array.from({ length: 34 }).map((_, i) => {
                    const day = i - 5
                    if (day < 1 || day > 31) return <span key={i} />
                    const unavailable = [3, 4, 5, 20, 21].includes(day)
                    const selected = selectedDay === day
                    return (
                      <button
                        key={i}
                        disabled={unavailable}
                        onClick={() => setSelectedDay(day)}
                        className={`aspect-square rounded-lg text-sm font-medium transition-colors ${
                          selected
                            ? 'bg-primary text-primary-foreground'
                            : unavailable
                              ? 'cursor-not-allowed text-muted-foreground/30 line-through'
                              : 'text-foreground hover:bg-secondary'
                        }`}
                      >
                        {day}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </Reveal>

          {/* Reviews */}
          <Reveal>
            <div className="border-b border-border py-10">
              <div className="flex items-center gap-3">
                <h2 className="font-serif text-2xl font-semibold text-foreground">Avaliações</h2>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-sm font-semibold text-foreground">
                  <Star className="size-4 fill-gold text-gold" />
                  {pousada.rating.toFixed(1)}
                </span>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                {reviews.map((r) => (
                  <Card key={r.name} className="p-5">
                    <Quote className="size-6 text-primary/30" />
                    <p className="mt-3 text-sm leading-relaxed text-foreground">{r.text}</p>
                    <div className="mt-4 flex items-center gap-1 text-gold">
                      {Array.from({ length: r.rating }).map((_, i) => (
                        <Star key={i} className="size-3.5 fill-gold" />
                      ))}
                    </div>
                    <div className="mt-3">
                      <div className="text-sm font-semibold text-foreground">{r.name}</div>
                      <div className="text-xs text-muted-foreground">{r.location}</div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </Reveal>

          {/* Location */}
          <Reveal>
            <div className="py-10">
              <h2 className="font-serif text-2xl font-semibold text-foreground">Localização</h2>
              <div className="relative mt-6 h-72 overflow-hidden rounded-2xl border border-border bg-secondary">
                <div
                  className="absolute inset-0 opacity-70"
                  style={{
                    backgroundImage:
                      'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
                    backgroundSize: '40px 40px',
                  }}
                />
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                  <span className="relative flex size-4">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent/60" />
                    <span className="relative inline-flex size-4 rounded-full bg-accent" />
                  </span>
                </div>
                <div className="absolute bottom-4 left-4 rounded-xl glass px-4 py-2.5 text-sm">
                  <div className="font-semibold text-foreground">{pousada.city}, {pousada.state}</div>
                  <div className="text-xs text-muted-foreground">A 12 min do centro</div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>

        {/* Booking card */}
        <div className="order-first lg:order-none lg:relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="lg:sticky lg:top-24 rounded-3xl border border-border bg-card p-6 shadow-xl shadow-stone-deep/5"
          >
            <div className="flex items-end justify-between">
              <div>
                <span className="text-2xl font-semibold text-foreground">
                  {room ? `R$ ${nightly}` : 'Indisponível'}
                </span>
                {room && <span className="text-sm text-muted-foreground"> / diária</span>}
              </div>
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-foreground">
                <Star className="size-4 fill-gold text-gold" />
                {pousada.rating.toFixed(1)}
              </span>
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-border">
              <div className="grid grid-cols-2 divide-x divide-border border-b border-border">
                <label className="block p-3">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Check-in</span>
                  <input
                    type="date"
                    value={checkin}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(event) => {
                      const nextCheckin = event.target.value
                      setCheckin(nextCheckin)
                      if (checkout <= nextCheckin) setCheckout(addDays(nextCheckin, 1))
                    }}
                    className="mt-1 w-full bg-transparent text-sm font-medium text-foreground outline-none"
                  />
                </label>
                <label className="block p-3">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Check-out</span>
                  <input
                    type="date"
                    value={checkout}
                    min={addDays(checkin, 1)}
                    onChange={(event) => setCheckout(event.target.value)}
                    className="mt-1 w-full bg-transparent text-sm font-medium text-foreground outline-none"
                  />
                </label>
              </div>
              <div className="flex items-center justify-between p-3">
                <label className="min-w-0 flex-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Hóspedes</span>
                  <input
                    type="number"
                    value={guests}
                    min={1}
                    max={capacity}
                    onChange={(event) => setGuests(Number(event.target.value))}
                    className="mt-1 w-full bg-transparent text-sm font-medium text-foreground outline-none"
                  />
                </label>
                <Users className="size-4 text-muted-foreground" />
              </div>
            </div>

            <Link
              href={{
                pathname: `/pousada/${pousada.slug}/reservar`,
                query: { checkin, checkout, guests },
              }}
              aria-disabled={!canReserve}
              className={`mt-4 block w-full rounded-2xl py-3.5 text-center text-sm font-semibold transition-all ${
                canReserve
                  ? 'bg-accent text-accent-foreground hover:brightness-105'
                  : 'pointer-events-none bg-muted text-muted-foreground'
              }`}
            >
              Reservar agora
            </Link>
            <p className="mt-2 text-center text-xs text-muted-foreground">Você ainda não será cobrado</p>

            {room && (
              <div className="mt-5 space-y-2 text-sm">
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
                <div className="flex justify-between border-t border-border pt-3 text-base font-semibold text-foreground">
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
