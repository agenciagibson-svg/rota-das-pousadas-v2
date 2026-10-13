'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowRight,
  CalendarDays,
  Compass,
  Heart,
  MapPin,
  Mountain,
  Search,
  Star,
  Users,
  Waves,
} from 'lucide-react'
import { MagicWand } from '@/components/brand/magic-wand'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Pousada } from '@/types'
import { prepareCatalog, recommendPousadas } from '@/features/concierge'
import { formatPrice } from '@/lib/format'

type Mood = 'romance' | 'familia' | 'aventura' | 'descanso'
type Budget = 'economico' | 'conforto' | 'premium'

const moods: Array<{
  key: Mood
  label: string
  text: string
  icon: typeof Heart
  terms: string[]
}> = [
  {
    key: 'romance',
    label: 'A dois',
    text: 'Chalés, serra e clima reservado.',
    icon: Heart,
    terms: ['romantico', 'chale', 'serra', 'lareira', 'spa'],
  },
  {
    key: 'familia',
    label: 'Família',
    text: 'Conforto, espaço e dias tranquilos.',
    icon: Users,
    terms: ['familia', 'piscina', 'conforto', 'fazenda', 'pet'],
  },
  {
    key: 'aventura',
    label: 'Aventura',
    text: 'Natureza, trilhas e água por perto.',
    icon: Mountain,
    terms: ['trilha', 'cachoeira', 'natureza', 'ecoturismo', 'aventura'],
  },
  {
    key: 'descanso',
    label: 'Descanso',
    text: 'Silêncio, café lento e pausa real.',
    icon: Waves,
    terms: ['descanso', 'bem-estar', 'vista', 'campo', 'cafe'],
  },
]

const budgets: Array<{ key: Budget; label: string; max: number; description: string }> = [
  {
    key: 'economico',
    label: 'Até R$ 350',
    max: 350,
    description: 'Boa estadia com diária enxuta.',
  },
  {
    key: 'conforto',
    label: 'Até R$ 600',
    max: 600,
    description: 'Equilíbrio entre preço e experiência.',
  },
  {
    key: 'premium',
    label: 'Premium',
    max: Number.POSITIVE_INFINITY,
    description: 'Escolhas mais completas.',
  },
]

const companionLabels = {
  casal: 'casal',
  familia: 'família',
  amigos: 'amigos',
} as const

function buildSearchHref({
  destination,
  guests,
  nights,
  mood,
}: {
  destination: string
  guests: number
  nights: number
  mood: Mood
}) {
  const checkin = new Date()
  checkin.setDate(checkin.getDate() + 14)
  const checkout = new Date(checkin)
  checkout.setDate(checkout.getDate() + nights)

  const params = new URLSearchParams({
    busca: destination || moods.find((item) => item.key === mood)?.terms[0] || 'Natureza',
    checkin: checkin.toISOString().slice(0, 10),
    checkout: checkout.toISOString().slice(0, 10),
    hospedes: String(guests),
    concierge: '1',
  })

  return `/pousadas?${params.toString()}`
}

export function TravelConcierge({ pousadas }: { pousadas: Pousada[] }) {
  const [mood, setMood] = useState<Mood>('descanso')
  const [budget, setBudget] = useState<Budget>('conforto')
  const [destination, setDestination] = useState('')
  const [guests, setGuests] = useState(2)
  const [nights, setNights] = useState(2)
  const [companion, setCompanion] = useState<keyof typeof companionLabels>('casal')

  const moodConfig = moods.find((item) => item.key === mood) ?? moods[0]
  const budgetConfig = budgets.find((item) => item.key === budget) ?? budgets[1]
  const catalog = useMemo(() => prepareCatalog(pousadas), [pousadas])
  const recommendations = useMemo(
    () =>
      recommendPousadas(catalog, {
        terms: moodConfig.terms,
        maxPrice: budgetConfig.max,
        premium: budget === 'premium',
        destination,
      }),
    [catalog, moodConfig, budgetConfig, budget, destination],
  )
  const hero = recommendations[0]?.pousada
  const searchHref = buildSearchHref({ destination, guests, nights, mood })

  return (
    <div className="grid gap-8 lg:grid-cols-12">
      <aside className="bg-card rounded-3xl p-5 lg:sticky lg:top-28 lg:col-span-4 lg:self-start lg:p-6">
        <div className="flex items-center gap-3">
          <span className="concierge-wand-badge relative flex size-11 shrink-0 items-center justify-center rounded-full">
            <MagicWand className="size-5" />
          </span>
          <div>
            <p className="text-muted-foreground text-sm font-semibold">Concierge</p>
            <h2 className="text-h2 text-foreground">Monte sua rota</h2>
          </div>
        </div>

        <div className="mt-6 space-y-6">
          <div>
            <label htmlFor="concierge-destino" className="text-foreground text-sm font-medium">
              Destino desejado
            </label>
            <div className="relative mt-2">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2" />
              <input
                id="concierge-destino"
                name="destino"
                autoComplete="off"
                enterKeyHint="done"
                value={destination}
                onChange={(event) => setDestination(event.target.value)}
                placeholder="Ex.: Canastra, serra, praia"
                className="border-border bg-background focus-visible:border-foreground focus-visible:ring-ipe/60 h-12 w-full rounded-full border pr-4 pl-11 text-sm transition-colors outline-none focus-visible:ring-2"
              />
            </div>
          </div>

          <div>
            <p className="text-foreground text-sm font-medium">Clima da viagem</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {moods.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setMood(item.key)}
                    aria-pressed={mood === item.key}
                    className={cn(
                      'rounded-2xl border p-4 text-left transition',
                      mood === item.key
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background hover:border-primary/45',
                    )}
                  >
                    <Icon className="size-5" />
                    <span className="mt-3 block text-sm font-semibold">{item.label}</span>
                    <span
                      className={cn(
                        'mt-1 block text-xs leading-relaxed',
                        mood === item.key ? 'text-primary-foreground/75' : 'text-muted-foreground',
                      )}
                    >
                      {item.text}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <p className="text-foreground text-sm font-medium">Orçamento</p>
            <div className="mt-3 grid gap-2">
              {budgets.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setBudget(item.key)}
                  aria-pressed={budget === item.key}
                  className={cn(
                    'flex min-h-12 items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-sm transition-colors duration-(--motion-hover)',
                    budget === item.key
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border',
                  )}
                >
                  <span className="font-semibold">{item.label}</span>
                  <span
                    className={cn(
                      'text-xs',
                      budget === item.key ? 'text-primary-foreground/75' : 'text-muted-foreground',
                    )}
                  >
                    {item.description}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-foreground text-sm font-medium">Hóspedes</span>
              <input
                type="number"
                min={1}
                max={12}
                value={guests}
                onChange={(event) => setGuests(Number(event.target.value) || 1)}
                className="border-border bg-background focus-visible:border-foreground focus-visible:ring-ipe/60 mt-2 h-12 w-full rounded-2xl border px-4 text-sm tabular-nums outline-none focus-visible:ring-2"
              />
            </label>
            <label className="block">
              <span className="text-foreground text-sm font-medium">Noites</span>
              <input
                type="number"
                min={1}
                max={15}
                value={nights}
                onChange={(event) => setNights(Number(event.target.value) || 1)}
                className="border-border bg-background focus-visible:border-foreground focus-visible:ring-ipe/60 mt-2 h-12 w-full rounded-2xl border px-4 text-sm tabular-nums outline-none focus-visible:ring-2"
              />
            </label>
          </div>

          <div>
            <p className="text-foreground text-sm font-medium">Viajando com</p>
            <div className="mt-3 flex gap-2">
              {Object.entries(companionLabels).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setCompanion(key as keyof typeof companionLabels)}
                  aria-pressed={companion === key}
                  className={cn(
                    'min-h-11 rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-(--motion-hover)',
                    companion === key
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-foreground',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>

      <section className="min-w-0 lg:col-span-8">
        <div className="border-border bg-stone-deep text-linen overflow-hidden rounded-3xl border">
          <div className="grid lg:grid-cols-[1fr_0.82fr]">
            <div className="p-6 sm:p-8">
              <Badge variant="outline" size="lg" className="border-linen/25 text-linen">
                Roteiro recomendado
              </Badge>
              <h2 className="text-display-l mt-5" aria-live="polite">
                {destination
                  ? `Uma rota por ${destination}`
                  : `Uma rota de ${moodConfig.label.toLowerCase()}`}
              </h2>
              <p className="text-linen/70 mt-4 max-w-xl leading-relaxed">
                Para uma viagem de {nights} noite{nights === 1 ? '' : 's'} com {guests} hóspede
                {guests === 1 ? '' : 's'}, eu priorizaria {moodConfig.text.toLowerCase()} dentro do
                perfil {budgetConfig.label.toLowerCase()}.
              </p>
              <div className="text-linen/70 mt-6 flex flex-wrap gap-3 text-sm">
                <span className="bg-linen/10 inline-flex items-center gap-2 rounded-full px-4 py-2">
                  <Compass className="size-4" />
                  {companionLabels[companion]}
                </span>
                <span className="bg-linen/10 inline-flex items-center gap-2 rounded-full px-4 py-2">
                  <CalendarDays className="size-4" />
                  datas sugeridas em 14 dias
                </span>
              </div>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href={searchHref}
                  className={buttonVariants({ variant: 'accent', size: 'pill' })}
                >
                  Ver rota filtrada
                  <ArrowRight className="size-4" />
                </Link>
                {hero ? (
                  <Link
                    href={`/pousada/${hero.slug}`}
                    className="border-linen/20 text-linen hover:bg-linen hover:text-stone-deep inline-flex items-center justify-center rounded-full border px-5 py-3 text-sm font-semibold transition-colors"
                  >
                    Abrir melhor sugestão
                  </Link>
                ) : null}
              </div>
            </div>
            <div className="relative min-h-[320px] lg:min-h-full">
              {hero ? (
                <Image
                  src={hero.image || '/placeholder.svg'}
                  alt={hero.name}
                  fill
                  sizes="(max-width: 1024px) 100vw, 45vw"
                  className="object-cover opacity-85"
                />
              ) : null}
              <div className="from-stone-deep/70 absolute inset-0 bg-gradient-to-t to-transparent lg:bg-gradient-to-r" />
              {hero ? (
                <div className="border-linen/15 bg-stone-deep/55 absolute right-5 bottom-5 left-5 rounded-2xl border p-4 backdrop-blur-md">
                  <p className="text-linen/70 flex items-center gap-2 text-sm">
                    <MapPin className="size-4" />
                    {hero.city}, {hero.state}
                  </p>
                  <h3 className="text-h2 mt-1">{hero.name}</h3>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4">
          {recommendations.map(({ pousada }, index) => (
            <Link
              key={pousada.slug}
              href={`/pousada/${pousada.slug}`}
              className="group border-border bg-card hover:shadow-stone-deep/10 grid overflow-hidden rounded-2xl border transition hover:-translate-y-0.5 hover:shadow-xl sm:grid-cols-[180px_1fr]"
            >
              <div className="relative aspect-[4/3] sm:aspect-auto">
                <Image
                  src={pousada.image || '/placeholder.svg'}
                  alt={pousada.name}
                  fill
                  sizes="(max-width: 640px) 100vw, 180px"
                  className="object-cover transition-transform duration-(--motion-reveal) group-hover:scale-105"
                />
                <span className="bg-card text-foreground absolute top-3 left-3 rounded-full px-3 py-1 text-xs font-semibold">
                  #{index + 1}
                </span>
              </div>
              <div className="p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-muted-foreground flex items-center gap-2 text-sm">
                      <MapPin className="size-4" />
                      {pousada.city}, {pousada.state}
                    </p>
                    <h3 className="text-h3 text-foreground mt-1">{pousada.name}</h3>
                  </div>
                  <span className="text-foreground inline-flex items-center gap-1.5 text-sm font-semibold">
                    <Star className="fill-ipe text-ipe size-4" />
                    {pousada.rating.toFixed(1)}
                  </span>
                </div>
                <p className="text-muted-foreground mt-3 line-clamp-2 text-sm leading-relaxed">
                  {pousada.description}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {pousada.tags.slice(0, 4).map((tag) => (
                    <Badge key={tag} variant="secondary" size="sm">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <div className="mt-5 flex items-center justify-between gap-4">
                  <p className="text-foreground text-lg font-semibold tabular-nums">
                    {formatPrice(pousada.pricePerNight)}
                    <span className="text-muted-foreground text-sm font-normal"> / diária</span>
                  </p>
                  <span
                    className={cn(
                      buttonVariants({ size: 'pill-sm' }),
                      'group-hover:bg-accent group-hover:text-accent-foreground',
                    )}
                  >
                    Ver pousada
                    <ArrowRight className="size-3.5" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
