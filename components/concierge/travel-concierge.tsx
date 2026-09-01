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
  Sparkles,
  Star,
  Users,
  Waves,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Pousada } from '@/types'

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
    text: 'Chales, serra e clima reservado.',
    icon: Heart,
    terms: ['romantico', 'chale', 'serra', 'lareira', 'spa'],
  },
  {
    key: 'familia',
    label: 'Familia',
    text: 'Conforto, espaco e dias tranquilos.',
    icon: Users,
    terms: ['familia', 'piscina', 'conforto', 'fazenda', 'pet'],
  },
  {
    key: 'aventura',
    label: 'Aventura',
    text: 'Natureza, trilhas e agua por perto.',
    icon: Mountain,
    terms: ['trilha', 'cachoeira', 'natureza', 'ecoturismo', 'aventura'],
  },
  {
    key: 'descanso',
    label: 'Descanso',
    text: 'Silencio, cafe lento e pausa real.',
    icon: Waves,
    terms: ['descanso', 'bem-estar', 'vista', 'campo', 'cafe'],
  },
]

const budgets: Array<{ key: Budget; label: string; max: number; description: string }> = [
  { key: 'economico', label: 'Ate R$ 350', max: 350, description: 'Boa estadia com diaria enxuta.' },
  { key: 'conforto', label: 'Ate R$ 600', max: 600, description: 'Equilibrio entre preco e experiencia.' },
  { key: 'premium', label: 'Premium', max: Number.POSITIVE_INFINITY, description: 'Escolhas mais completas.' },
]

const companionLabels = {
  casal: 'casal',
  familia: 'familia',
  amigos: 'amigos',
} as const

function scorePousada(pousada: Pousada, mood: Mood, budget: Budget, destination: string) {
  const moodConfig = moods.find((item) => item.key === mood) ?? moods[0]
  const budgetConfig = budgets.find((item) => item.key === budget) ?? budgets[1]
  const text = `${pousada.name} ${pousada.city} ${pousada.state} ${pousada.description} ${pousada.tags.join(' ')}`.toLowerCase()
  let score = pousada.rating * 12 + Math.min(pousada.reviews, 200) / 10

  for (const term of moodConfig.terms) {
    if (text.includes(term)) score += 18
  }

  if (destination && text.includes(destination.toLowerCase())) score += 40
  if (pousada.pricePerNight <= budgetConfig.max) score += 28
  if (budget === 'premium' && pousada.pricePerNight >= 500) score += 16
  if (budget !== 'premium' && pousada.pricePerNight > budgetConfig.max) {
    score -= Math.min(34, (pousada.pricePerNight - budgetConfig.max) / 10)
  }

  return score
}

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

  const recommendations = useMemo(() => {
    return [...pousadas]
      .map((pousada) => ({
        pousada,
        score: scorePousada(pousada, mood, budget, destination),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
  }, [budget, destination, mood, pousadas])

  const hero = recommendations[0]?.pousada
  const moodConfig = moods.find((item) => item.key === mood) ?? moods[0]
  const budgetConfig = budgets.find((item) => item.key === budget) ?? budgets[1]
  const searchHref = buildSearchHref({ destination, guests, nights, mood })

  return (
    <div className="grid gap-8 lg:grid-cols-12">
      <aside className="rounded-3xl border border-border bg-card p-5 shadow-card lg:sticky lg:top-28 lg:col-span-4 lg:self-start">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Sparkles className="size-5" />
          </span>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Concierge</p>
            <h2 className="font-serif text-2xl font-semibold text-foreground">Monte sua rota</h2>
          </div>
        </div>

        <div className="mt-6 space-y-6">
          <div>
            <label className="text-xs font-semibold uppercase text-muted-foreground">Destino desejado</label>
            <div className="relative mt-2">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={destination}
                onChange={(event) => setDestination(event.target.value)}
                placeholder="Ex.: Canastra, serra, praia"
                className="h-12 w-full rounded-full border border-border bg-background pl-11 pr-4 text-sm outline-none transition-colors focus:border-primary"
              />
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Clima da viagem</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {moods.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setMood(item.key)}
                    className={cn(
                      'rounded-2xl border p-4 text-left transition-all',
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
            <p className="text-xs font-semibold uppercase text-muted-foreground">Orcamento</p>
            <div className="mt-3 grid gap-2">
              {budgets.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setBudget(item.key)}
                  className={cn(
                    'flex items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm transition-colors',
                    budget === item.key ? 'border-primary bg-primary/10 text-primary' : 'border-border',
                  )}
                >
                  <span className="font-semibold">{item.label}</span>
                  <span className="text-xs text-muted-foreground">{item.description}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-semibold uppercase text-muted-foreground">Hospedes</span>
              <input
                type="number"
                min={1}
                max={12}
                value={guests}
                onChange={(event) => setGuests(Number(event.target.value) || 1)}
                className="mt-2 h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none focus:border-primary"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase text-muted-foreground">Noites</span>
              <input
                type="number"
                min={1}
                max={15}
                value={nights}
                onChange={(event) => setNights(Number(event.target.value) || 1)}
                className="mt-2 h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm outline-none focus:border-primary"
              />
            </label>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Viajando com</p>
            <div className="mt-3 flex gap-2">
              {Object.entries(companionLabels).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setCompanion(key as keyof typeof companionLabels)}
                  className={cn(
                    'rounded-full px-4 py-2 text-xs font-semibold transition-colors',
                    companion === key ? 'bg-accent text-accent-foreground' : 'bg-secondary text-foreground',
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
        <div className="overflow-hidden rounded-3xl border border-border bg-stone-deep text-linen">
          <div className="grid lg:grid-cols-[1fr_0.82fr]">
            <div className="p-6 sm:p-8">
              <Badge variant="glass" size="lg" className="bg-linen/10 text-linen">
                Roteiro recomendado
              </Badge>
              <h2 className="mt-5 text-balance font-serif text-4xl font-semibold leading-tight sm:text-5xl">
                {destination ? `Uma rota por ${destination}` : `Uma rota de ${moodConfig.label.toLowerCase()}`}
              </h2>
              <p className="mt-4 max-w-xl leading-relaxed text-linen/70">
                Para uma viagem de {nights} noite{nights === 1 ? '' : 's'} com {guests} hospede
                {guests === 1 ? '' : 's'}, eu priorizaria {moodConfig.text.toLowerCase()} dentro do
                perfil {budgetConfig.label.toLowerCase()}.
              </p>
              <div className="mt-6 flex flex-wrap gap-3 text-sm text-linen/70">
                <span className="inline-flex items-center gap-2 rounded-full bg-linen/10 px-4 py-2">
                  <Compass className="size-4" />
                  {companionLabels[companion]}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-linen/10 px-4 py-2">
                  <CalendarDays className="size-4" />
                  datas sugeridas em 14 dias
                </span>
              </div>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href={searchHref}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground transition-transform hover:-translate-y-0.5"
                >
                  Ver rota filtrada
                  <ArrowRight className="size-4" />
                </Link>
                {hero ? (
                  <Link
                    href={`/pousada/${hero.slug}`}
                    className="inline-flex items-center justify-center rounded-full border border-linen/20 px-5 py-3 text-sm font-semibold text-linen transition-colors hover:bg-linen hover:text-stone-deep"
                  >
                    Abrir melhor sugestao
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
              <div className="absolute inset-0 bg-gradient-to-t from-stone-deep/70 to-transparent lg:bg-gradient-to-r" />
              {hero ? (
                <div className="absolute bottom-5 left-5 right-5 rounded-2xl border border-linen/15 bg-stone-deep/55 p-4 backdrop-blur-md">
                  <p className="flex items-center gap-2 text-sm text-linen/70">
                    <MapPin className="size-4" />
                    {hero.city}, {hero.state}
                  </p>
                  <h3 className="mt-1 font-serif text-2xl font-semibold">{hero.name}</h3>
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
              className="group grid overflow-hidden rounded-2xl border border-border bg-card transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-stone-deep/10 sm:grid-cols-[180px_1fr]"
            >
              <div className="relative aspect-[4/3] sm:aspect-auto">
                <Image
                  src={pousada.image || '/placeholder.svg'}
                  alt={pousada.name}
                  fill
                  sizes="(max-width: 640px) 100vw, 180px"
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <span className="absolute left-3 top-3 rounded-full bg-card px-3 py-1 text-xs font-semibold text-foreground">
                  #{index + 1}
                </span>
              </div>
              <div className="p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="size-4" />
                      {pousada.city}, {pousada.state}
                    </p>
                    <h3 className="mt-1 font-serif text-2xl font-semibold text-foreground">{pousada.name}</h3>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    <Star className="size-4 fill-gold text-gold" />
                    {pousada.rating.toFixed(1)}
                  </span>
                </div>
                <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
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
                  <p className="text-lg font-semibold text-foreground">
                    R$ {pousada.pricePerNight}
                    <span className="text-xs font-normal text-muted-foreground"> / diaria</span>
                  </p>
                  <span className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground group-hover:bg-accent">
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
