'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion, AnimatePresence } from 'motion/react'
import { ArrowUpRight, CalendarDays, Clock, Flame, Sparkles, Tag } from 'lucide-react'
import { isoDateInTimeZone } from '@/lib/dates'
import { Reveal } from '@/components/reveal'

type SeasonKey = 'verao' | 'outono' | 'inverno' | 'primavera'

type Offer = {
  title: string
  location: string
  image: string
  search: string
  badge: string
  price: string
  perk: string
}

const seasonLabels: Record<SeasonKey, string> = {
  verao: 'Verão',
  outono: 'Outono',
  inverno: 'Inverno',
  primavera: 'Primavera',
}

const offers: Record<
  SeasonKey,
  { eyebrow: string; title: string; description: string; accent: string; items: Offer[] }
> = {
  verao: {
    eyebrow: 'Ofertas de verão',
    title: 'Escapadas com água por perto',
    description:
      'Praias, piscinas e cachoeiras para quem quer reservar antes das melhores datas sumirem.',
    accent: 'text-ocean',
    items: [
      {
        title: 'Mar azul sem pressa',
        location: 'Fernando de Noronha, PE',
        image: '/images/noronha.png',
        search: 'Praia',
        badge: 'alta procura',
        price: 'a partir de R$ 890',
        perk: 'vista mar + café premium',
      },
      {
        title: 'Cachoeiras e canyon',
        location: 'Capitólio, MG',
        image: '/images/capitolio.png',
        search: 'Cachoeiras',
        badge: 'fim de semana',
        price: 'a partir de R$ 380',
        perk: 'piscina + roteiro de águas',
      },
      {
        title: 'Natureza cristalina',
        location: 'Bonito, MS',
        image: '/images/bonito.png',
        search: 'Bonito',
        badge: 'família',
        price: 'a partir de R$ 460',
        perk: 'flutuação + descanso',
      },
    ],
  },
  outono: {
    eyebrow: 'Ofertas de outono',
    title: 'Rotas douradas e pousadas de campo',
    description:
      'Hospedagens para desacelerar, caminhar sem pressa e aproveitar a luz mais bonita do ano.',
    accent: 'text-gold',
    items: [
      {
        title: 'Serra em tons dourados',
        location: 'Serra da Canastra, MG',
        image: '/images/canastra.png',
        search: 'Canastra',
        badge: 'curadoria',
        price: 'a partir de R$ 340',
        perk: 'trilhas + queijo da região',
      },
      {
        title: 'Campo com vista',
        location: 'Monte Verde, MG',
        image: '/images/monteverde.png',
        search: 'Natureza',
        badge: 'casais',
        price: 'a partir de R$ 410',
        perk: 'varanda + café lento',
      },
      {
        title: 'Refúgio de silêncio',
        location: 'Campos do Jordão, SP',
        image: '/images/campos.png',
        search: 'Trilhas',
        badge: 'meio de semana',
        price: 'a partir de R$ 490',
        perk: 'bosque + lareira externa',
      },
    ],
  },
  inverno: {
    eyebrow: 'Ofertas de inverno',
    title: 'Chales, lareiras e serra com clima de reserva agora',
    description:
      'A estação atual pede pousadas aconchegantes, noites frias e datas bem escolhidas.',
    accent: 'text-accent',
    items: [
      {
        title: 'Chale com lareira acesa',
        location: 'Gramado, RS',
        image: '/images/gramado.png',
        search: 'Lareira',
        badge: 'inverno agora',
        price: 'a partir de R$ 520',
        perk: 'vinho + café colonial',
      },
      {
        title: 'Serra para dois',
        location: 'Monte Verde, MG',
        image: '/images/pousada-1.png',
        search: 'Chales',
        badge: 'romântico',
        price: 'a partir de R$ 720',
        perk: 'banheira + varanda',
      },
      {
        title: 'Fim de semana premium',
        location: 'Campos do Jordão, SP',
        image: '/images/campos.png',
        search: 'Serra',
        badge: 'últimas datas',
        price: 'a partir de R$ 490',
        perk: 'montanha + gastronomia',
      },
    ],
  },
  primavera: {
    eyebrow: 'Ofertas de primavera',
    title: 'Natureza viva, jardins e bem-estar',
    description: 'Rotas para respirar melhor, caminhar no verde e escolher pousadas com alma leve.',
    accent: 'text-primary',
    items: [
      {
        title: 'Verde renascido',
        location: 'Serra da Canastra, MG',
        image: '/images/hero.png',
        search: 'Ecoturismo',
        badge: 'natureza',
        price: 'a partir de R$ 340',
        perk: 'trilhas + banho de rio',
      },
      {
        title: 'Águas e flores',
        location: 'Bonito, MS',
        image: '/images/bonito.png',
        search: 'Natureza',
        badge: 'bem-estar',
        price: 'a partir de R$ 460',
        perk: 'flutuação + jardim',
      },
      {
        title: 'Pousada no bosque',
        location: 'Monte Verde, MG',
        image: '/images/gallery-1.png',
        search: 'Bem-estar',
        badge: 'descanso',
        price: 'a partir de R$ 410',
        perk: 'spa + ar puro',
      },
    ],
  },
}

function getCurrentBrazilSeason(date = new Date()): SeasonKey {
  const month = date.getMonth() + 1
  const day = date.getDate()
  const numericDate = month * 100 + day

  if (numericDate >= 1221 || numericDate < 320) return 'verao'
  if (numericDate >= 320 && numericDate < 621) return 'outono'
  if (numericDate >= 621 && numericDate < 923) return 'inverno'
  return 'primavera'
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

function offerHref(season: SeasonKey, search: string) {
  const today = todayIso()
  const checkin = addDays(today, 7)
  const checkout = addDays(checkin, 2)
  const params = new URLSearchParams({
    busca: search,
    checkin,
    checkout,
    hospedes: '2',
    temporada: season,
    oferta: 'estacao',
  })
  return `/pousadas?${params.toString()}`
}

export function SeasonalOffers() {
  const [season, setSeason] = useState<SeasonKey>(() => getCurrentBrazilSeason())
  const current = offers[season]

  return (
    <section id="ofertas" className="bg-stone-deep text-linen py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <Reveal>
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div className="max-w-2xl">
              <span
                className={`inline-flex items-center gap-2 text-sm font-semibold tracking-[0.2em] uppercase ${current.accent}`}
              >
                <Flame className="size-4" />
                {current.eyebrow}
              </span>
              <h2 className="mt-3 font-serif text-3xl leading-tight font-semibold text-balance sm:text-5xl">
                {current.title}
              </h2>
              <p className="text-linen/68 mt-4 leading-relaxed text-pretty">
                {current.description}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {(Object.keys(offers) as SeasonKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSeason(key)}
                  className={`rounded-full px-4 py-2 text-xs font-semibold transition-all ${
                    season === key
                      ? 'bg-linen text-stone-deep'
                      : 'border-linen/15 text-linen/65 hover:border-linen/35 hover:text-linen border'
                  }`}
                >
                  {seasonLabels[key]}
                </button>
              ))}
            </div>
          </div>
        </Reveal>

        <AnimatePresence mode="wait">
          <motion.div
            key={season}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="mt-10 grid gap-5 lg:grid-cols-3"
          >
            {current.items.map((offer, index) => (
              <Link
                key={offer.title}
                href={offerHref(season, offer.search)}
                className={`group border-linen/10 bg-linen/[0.06] hover:bg-linen/[0.09] overflow-hidden rounded-2xl border transition-all hover:-translate-y-1 ${
                  index === 0 ? 'lg:col-span-1' : ''
                }`}
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  <Image
                    src={offer.image}
                    alt={offer.title}
                    fill
                    sizes="(max-width: 1024px) 100vw, 33vw"
                    className="object-cover opacity-85 transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="from-stone-deep/80 via-stone-deep/10 absolute inset-0 bg-gradient-to-t to-transparent" />
                  <span className="bg-linen text-stone-deep absolute top-4 left-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold">
                    <Tag className="size-3.5" />
                    {offer.badge}
                  </span>
                  <div className="absolute right-4 bottom-4 left-4">
                    <p className="text-linen/75 text-sm font-medium">{offer.location}</p>
                    <h3 className="text-linen mt-1 font-serif text-2xl leading-tight font-semibold">
                      {offer.title}
                    </h3>
                  </div>
                </div>

                <div className="p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-linen text-lg font-semibold">{offer.price}</p>
                      <p className="text-linen/55 mt-1 text-sm">{offer.perk}</p>
                    </div>
                    <span className="bg-accent text-accent-foreground flex size-10 shrink-0 items-center justify-center rounded-full transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                      <ArrowUpRight className="size-4" />
                    </span>
                  </div>
                  <div className="text-linen/50 mt-5 flex items-center gap-2 text-xs">
                    <CalendarDays className="size-3.5" />
                    Datas sugeridas para daqui 7 dias
                    <Clock className="ml-auto size-3.5" />
                  </div>
                </div>
              </Link>
            ))}
          </motion.div>
        </AnimatePresence>

        <div className="border-linen/10 bg-linen/[0.04] mt-8 flex flex-col gap-3 rounded-2xl border p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="bg-linen text-stone-deep flex size-10 items-center justify-center rounded-full">
              <Sparkles className="size-5" />
            </span>
            <div>
              <p className="text-linen font-semibold">Ofertas vivas por temporada</p>
              <p className="text-linen/55 text-sm">
                Depois podemos conectar isso a preços reais, ocupação e feriados.
              </p>
            </div>
          </div>
          <Link
            href={offerHref(season, current.items[0].search)}
            className="bg-linen text-stone-deep hover:bg-accent hover:text-accent-foreground inline-flex w-fit rounded-full px-5 py-2.5 text-sm font-semibold transition-colors"
          >
            Ver ofertas da estação
          </Link>
        </div>
      </div>
    </section>
  )
}
