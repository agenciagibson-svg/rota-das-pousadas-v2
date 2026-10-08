'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'motion/react'
import { ArrowRight, Shuffle, Sparkles } from 'lucide-react'
import type { Pousada } from '@/types'
import { Button, buttonVariants } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import { duration, easing } from '@/lib/design-tokens'
import { cn } from '@/lib/utils'
import { HeroFeaturedCard } from './hero-featured-card'
import { HeroSearchBar, HeroSearchSheet } from './hero-search'
import {
  addDays,
  getCurrentBrazilSeason,
  seasonOrder,
  seasons,
  surpriseRoutes,
  todayIso,
  type SeasonKey,
} from './seasons'

const ease = [...easing.standard] as [number, number, number, number]

/**
 * Hero da home viva: a foto da estação ocupa a tela, o texto e a busca
 * flutuam por cima em vidro, e o Ipê marca a ação de buscar.
 */
export function Hero({ featured }: { featured?: Pousada }) {
  const router = useRouter()
  const [season, setSeason] = useState<SeasonKey>(() => getCurrentBrazilSeason())
  const current = seasons[season]

  function openSurpriseRoute() {
    const options = surpriseRoutes[season]
    const query = options[Math.floor(Math.random() * options.length)]
    const tomorrow = addDays(todayIso(), 1)
    const params = new URLSearchParams({
      busca: query,
      checkin: tomorrow,
      checkout: addDays(tomorrow, 1),
      hospedes: '2',
      temporada: season,
      surpresa: '1',
    })
    router.push(`/pousadas?${params.toString()}`)
  }

  const actions = (
    <div className="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-3">
      <Button type="button" onClick={openSurpriseRoute} variant="glass" size="pill">
        <Shuffle className="size-4" />
        Rota surpresa
      </Button>
      <a
        href="#destinos"
        className={cn(
          buttonVariants({ variant: 'link', size: 'pill' }),
          'text-primary-foreground px-0',
        )}
      >
        Explorar destinos em destaque
        <ArrowRight className="size-4" />
      </a>
    </div>
  )

  return (
    <section className="bg-breu text-primary-foreground relative isolate min-h-[100svh] w-full overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={current.image}
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: duration.reveal, ease }}
          className="absolute inset-0 -z-10"
        >
          <Image
            src={current.image}
            alt={current.alt}
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        </motion.div>
      </AnimatePresence>
      {/* Sombra só onde há texto: topo (cabeçalho) e base (título e busca). */}
      <div className="from-breu/55 via-breu/5 to-breu/85 absolute inset-0 -z-10 bg-gradient-to-b" />
      <div className="from-breu/50 absolute inset-0 -z-10 hidden bg-gradient-to-r to-transparent to-60% lg:block" />

      {featured && <HeroFeaturedCard pousada={featured} />}

      <Container className="flex min-h-[100svh] flex-col justify-end pt-28 pb-8 lg:pb-12">
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="text-primary-foreground/80 inline-flex shrink-0 items-center gap-1.5 pr-1 text-xs font-semibold">
            <Sparkles className="text-ipe size-3.5" />
            Home viva
          </span>
          {seasonOrder.map((key) => (
            <Button
              key={key}
              type="button"
              aria-pressed={season === key}
              onClick={() => setSeason(key)}
              variant={season === key ? 'inverse' : 'glass'}
              size="pill-sm"
            >
              {seasons[key].label}
            </Button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={season}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: duration.reveal, ease }}
            className="max-w-4xl"
          >
            <h1 className="text-display-xl">
              <span className="block">{current.headline[0]}</span>
              <span className="block font-light">{current.headline[1]}</span>
            </h1>
            <p className="text-body-l text-primary-foreground/85 mt-5 max-w-xl text-pretty">
              {current.sub}
            </p>
          </motion.div>
        </AnimatePresence>

        <div className="mt-8">
          <HeroSearchBar season={season} tags={current.tags} trailing={actions} />
          <HeroSearchSheet season={season} tags={current.tags} />
          <div className="mt-5 lg:hidden">{actions}</div>
        </div>
      </Container>
    </section>
  )
}
