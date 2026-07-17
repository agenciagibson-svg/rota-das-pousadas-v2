'use client'

import { useState } from 'react'
import Image from 'next/image'
import { motion } from 'motion/react'
import {
  Star,
  MapPin,
  Share2,
  Heart,
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
  Play,
  ChevronLeft,
  ChevronRight,
  Users,
  Quote,
  Compass,
} from 'lucide-react'
import type { Pousada } from '@/lib/data'
import { amenities, rooms, reviews } from '@/lib/data'
import { Reveal } from '@/components/reveal'

const amenityIcons = [Wifi, Coffee, Flame, Bath, WavesLadder, Car, PawPrint, Wind, Mountain, BellRing, Sparkles, Trees]

export function PousadaDetail({ pousada }: { pousada: Pousada }) {
  const [active, setActive] = useState(0)
  const [nights] = useState(2)
  const [selectedRoom, setSelectedRoom] = useState(0)
  const [selectedDay, setSelectedDay] = useState<number | null>(14)

  const room = rooms[selectedRoom]
  const subtotal = room.price * nights
  const fee = Math.round(subtotal * 0.08)
  const total = subtotal + fee

  return (
    <div className="pb-24">
      {/* Gallery */}
      <section className="mx-auto max-w-7xl px-5 pt-28 lg:px-8">
        <div className="grid grid-cols-1 gap-2 overflow-hidden rounded-3xl md:grid-cols-4 md:grid-rows-2 md:h-[520px]">
          <div className="relative md:col-span-2 md:row-span-2 h-64 md:h-auto">
            <Image src={pousada.gallery[0] || '/placeholder.svg'} alt={pousada.name} fill sizes="50vw" className="object-cover" priority />
            <button className="absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-full glass px-4 py-2 text-sm font-semibold text-foreground">
              <Play className="size-4 fill-foreground" />
              Tour virtual
            </button>
          </div>
          {pousada.gallery.slice(1, 5).map((img, i) => (
            <div key={i} className="relative hidden h-full min-h-[120px] md:block">
              <Image src={img || '/placeholder.svg'} alt={`${pousada.name} ${i + 2}`} fill sizes="25vw" className="object-cover" />
              {i === 3 && (
                <button className="absolute bottom-3 right-3 rounded-full glass px-4 py-2 text-xs font-semibold text-foreground">
                  Ver todas as fotos
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Header */}
      <section className="mx-auto max-w-7xl px-5 pt-8 lg:px-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {pousada.tags.map((t) => (
                <span key={t} className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                  {t}
                </span>
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
            </div>
          </div>
          <div className="flex gap-2">
            <button className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary">
              <Share2 className="size-4" />
              Compartilhar
            </button>
            <button className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary">
              <Heart className="size-4" />
              Salvar
            </button>
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
              <div className="mt-6 space-y-3">
                {rooms.map((r, i) => (
                  <button
                    key={r.name}
                    onClick={() => setSelectedRoom(i)}
                    className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left transition-all ${
                      selectedRoom === i ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
                    }`}
                  >
                    <div>
                      <h3 className="font-semibold text-foreground">{r.name}</h3>
                      <p className="mt-0.5 text-sm text-muted-foreground">{r.desc}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {r.size} • até {r.guests} hóspedes
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-semibold text-foreground">R$ {r.price}</div>
                      <div className="text-xs text-muted-foreground">/ diária</div>
                    </div>
                  </button>
                ))}
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
                  <div key={r.name} className="rounded-2xl border border-border bg-card p-5">
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
                  </div>
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
        <div className="lg:relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="lg:sticky lg:top-24 rounded-3xl border border-border bg-card p-6 shadow-xl shadow-stone-deep/5"
          >
            <div className="flex items-end justify-between">
              <div>
                <span className="text-2xl font-semibold text-foreground">R$ {room.price}</span>
                <span className="text-sm text-muted-foreground"> / diária</span>
              </div>
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-foreground">
                <Star className="size-4 fill-gold text-gold" />
                {pousada.rating.toFixed(1)}
              </span>
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-border">
              <div className="grid grid-cols-2 divide-x divide-border border-b border-border">
                <div className="p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Check-in</div>
                  <div className="text-sm font-medium text-foreground">14 Mar 2026</div>
                </div>
                <div className="p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Check-out</div>
                  <div className="text-sm font-medium text-foreground">16 Mar 2026</div>
                </div>
              </div>
              <div className="flex items-center justify-between p-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Hóspedes</div>
                  <div className="text-sm font-medium text-foreground">2 adultos</div>
                </div>
                <Users className="size-4 text-muted-foreground" />
              </div>
            </div>

            <button className="mt-4 w-full rounded-2xl bg-accent py-3.5 text-sm font-semibold text-accent-foreground transition-all hover:brightness-105">
              Reservar {room.name}
            </button>
            <p className="mt-2 text-center text-xs text-muted-foreground">Você ainda não será cobrado</p>

            <div className="mt-5 space-y-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>R$ {room.price} × {nights} noites</span>
                <span>R$ {subtotal}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Taxa de serviço</span>
                <span>R$ {fee}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-3 text-base font-semibold text-foreground">
                <span>Total</span>
                <span>R$ {total}</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
