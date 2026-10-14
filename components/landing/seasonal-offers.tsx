'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion, AnimatePresence } from 'motion/react'
import { ArrowUpRight, CalendarDays, Clock, Sparkles, Tag } from 'lucide-react'
import { Reveal } from '@/components/reveal'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import { SectionHeading } from '@/components/ui/section-heading'
import { duration, easing } from '@/lib/design-tokens'
import { cn } from '@/lib/utils'
import { addDays, getCurrentBrazilSeason, seasonOrder, todayIso, type SeasonKey } from './seasons'

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
  { eyebrow: string; title: string; description: string; items: Offer[] }
> = {
  verao: {
    eyebrow: 'Ofertas de verão',
    title: 'Escapadas com água por perto',
    description:
      'Praias, piscinas e cachoeiras para quem quer reservar antes das melhores datas sumirem.',
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
    <section id="ofertas" className="bg-breu text-neblina py-16 lg:py-24">
      <Container>
        <Reveal>
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <SectionHeading
              tone="dark"
              eyebrow={current.eyebrow}
              title={current.title}
              description={current.description}
            />
            <div className="flex flex-wrap gap-2">
              {seasonOrder.map((key) => (
                <Button
                  key={key}
                  type="button"
                  aria-pressed={season === key}
                  onClick={() => setSeason(key)}
                  variant={season === key ? 'inverse' : 'glass'}
                  size="pill-sm"
                >
                  {seasonLabels[key]}
                </Button>
              ))}
            </div>
          </div>
        </Reveal>

        <AnimatePresence mode="wait">
          <motion.ul
            key={season}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: duration.page, ease: [...easing.standard] }}
            className="-mx-5 mt-10 flex snap-x snap-mandatory scroll-px-5 [scrollbar-width:none] gap-4 overflow-x-auto px-5 pb-2 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 md:pb-0 lg:gap-6"
          >
            {current.items.map((offer) => (
              <li key={offer.title} className="w-[85%] shrink-0 snap-start md:w-auto">
                <Link
                  href={offerHref(season, offer.search)}
                  className="group border-neblina/10 bg-neblina/[0.06] hover:bg-neblina/10 flex h-full flex-col overflow-hidden rounded-3xl border transition-colors duration-(--motion-fade)"
                >
                  <div className="relative aspect-[4/3] overflow-hidden">
                    <Image
                      src={offer.image}
                      alt={offer.title}
                      fill
                      sizes="(max-width: 768px) 100vw, 33vw"
                      className="object-cover transition-transform duration-(--motion-reveal) group-hover:scale-105"
                    />
                    <div className="from-breu/85 via-breu/10 absolute inset-0 bg-gradient-to-t to-transparent" />
                    <Badge variant="glass" size="lg" className="absolute top-4 left-4">
                      <Tag className="size-3.5" />
                      {offer.badge}
                    </Badge>
                    <div className="absolute right-5 bottom-4 left-5">
                      <p className="text-neblina/80 text-sm font-medium">{offer.location}</p>
                      <h3 className="text-h2 text-neblina mt-1">{offer.title}</h3>
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-lg font-semibold tabular-nums">{offer.price}</p>
                        <p className="text-liquen mt-1 text-sm">{offer.perk}</p>
                      </div>
                      <span className="bg-accent text-accent-foreground flex size-12 shrink-0 items-center justify-center rounded-full transition-transform duration-(--motion-hover) group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                        <ArrowUpRight className="size-5" />
                      </span>
                    </div>
                    <div className="text-liquen mt-auto flex items-center gap-2 pt-5 text-xs">
                      <CalendarDays className="size-3.5" />
                      Datas sugeridas para daqui 7 dias
                      <Clock className="ml-auto size-3.5" />
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </motion.ul>
        </AnimatePresence>

        <div className="border-neblina/10 mt-8 flex flex-col gap-4 rounded-3xl border p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="bg-neblina/10 flex size-10 shrink-0 items-center justify-center rounded-full">
              <Sparkles className="text-ipe size-5" />
            </span>
            <div>
              <p className="font-semibold">Ofertas vivas por temporada</p>
              <p className="text-liquen text-sm">
                Depois podemos conectar isso a preços reais, ocupação e feriados.
              </p>
            </div>
          </div>
          <Link
            href={offerHref(season, current.items[0].search)}
            className={cn(buttonVariants({ variant: 'inverse', size: 'pill' }), 'w-fit')}
          >
            Ver ofertas da estação
          </Link>
        </div>
      </Container>
    </section>
  )
}
