'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { ArrowRight, Pause, Play, Shuffle, Sparkles } from 'lucide-react'
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
  nextSeason,
  seasonImages,
  seasonOrder,
  seasons,
  surpriseRoutes,
  todayIso,
  type SeasonKey,
} from './seasons'

const ease = [...easing.standard] as [number, number, number, number]

/** Tempo de cada estação na tela antes de girar para a próxima. */
const ROTATE_MS = 7000
/** Depois de escolher uma estação na mão, ela fica parada por este tempo. */
const HOLD_AFTER_PICK_MS = 20000

/** Alguém digitando na busca ou com a gaveta de busca aberta: não troca nada. */
function isUserBusy(): boolean {
  const el = document.activeElement
  if (!el || el === document.body) return false
  return Boolean(el.closest('input, textarea, select, [role="dialog"], [data-hero-hold]'))
}

/**
 * Hero da home viva: a foto da estação ocupa a tela, o texto e a busca
 * flutuam por cima em vidro, e o Ipê marca a ação de buscar.
 */
export function Hero({ featured }: { featured?: Pousada }) {
  const router = useRouter()
  const [season, setSeason] = useState<SeasonKey>(() => getCurrentBrazilSeason())
  const current = seasons[season]
  // Foto da vez em cada estação; -1 = estação ainda não exibida. Cada nova
  // volta pela estação mostra a foto seguinte.
  const [photoIndex, setPhotoIndex] = useState<Record<SeasonKey, number>>(() => ({
    verao: -1,
    outono: -1,
    inverno: -1,
    primavera: -1,
    [season]: 0,
  }))
  const [paused, setPaused] = useState(false)
  const [hovering, setHovering] = useState(false)
  // Estação escolhida na mão fica parada um tempo antes de voltar a girar.
  const [held, setHeld] = useState(false)
  // Muda quando a troca foi adiada (alguém digitando): agenda de novo.
  const [retry, setRetry] = useState(0)
  const reduceMotion = useReducedMotion()

  const photos = seasonImages[season]
  const photo = photos[Math.max(0, photoIndex[season]) % photos.length]!
  const upcomingSeason = nextSeason(season)
  const upcomingPhotos = seasonImages[upcomingSeason]
  const upcomingPhoto = upcomingPhotos[(photoIndex[upcomingSeason] + 1) % upcomingPhotos.length]!

  const goTo = useCallback((key: SeasonKey) => {
    setPhotoIndex((prev) => ({ ...prev, [key]: prev[key] + 1 }))
    setSeason(key)
  }, [])

  function pickSeason(key: SeasonKey) {
    setHeld(true)
    setRetry((n) => n + 1)
    if (key !== season) goTo(key)
  }

  // Estações girando sozinhas. Para quando a pessoa pausa, prefere menos
  // movimento, está com o mouse sobre a busca ou digitando nela.
  const autoRotate = !paused && !reduceMotion && !hovering
  useEffect(() => {
    if (!autoRotate) return
    const timer = window.setTimeout(
      () => {
        if (held) {
          setHeld(false)
          return
        }
        if (document.hidden || isUserBusy()) {
          setRetry((n) => n + 1)
          return
        }
        goTo(nextSeason(season))
      },
      held ? HOLD_AFTER_PICK_MS : ROTATE_MS,
    )
    return () => window.clearTimeout(timer)
  }, [autoRotate, season, held, retry, goTo])

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
      <AnimatePresence initial={false}>
        <motion.div
          key={photo.src}
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: duration.reveal * 1.6, ease }}
          className="absolute inset-0 -z-20"
        >
          <Image
            src={photo.src}
            alt={photo.alt}
            fill
            priority={photo.src === seasonImages[getCurrentBrazilSeason()][0]!.src}
            sizes="100vw"
            className="object-cover"
          />
        </motion.div>
      </AnimatePresence>
      {/* Pré-carrega a próxima foto para a troca não piscar o fundo escuro. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-30 opacity-0">
        <Image src={upcomingPhoto.src} alt="" fill sizes="100vw" className="object-cover" />
      </div>
      {/* Sombra só onde há texto: topo (cabeçalho) e base (título e busca). */}
      <div className="from-breu/55 via-breu/5 to-breu/85 absolute inset-0 -z-10 bg-gradient-to-b" />
      <div className="from-breu/50 absolute inset-0 -z-10 hidden bg-gradient-to-r to-transparent to-60% lg:block" />
      {/* Véu desfocado atrás do título: recifes, trilhas e galhos da foto não
          disputam com as letras. Some para cima em degradê, sem corte. */}
      <div className="hero-text-veil absolute inset-x-0 bottom-0 -z-10 h-[68%] lg:h-[62%]" />

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
              onClick={() => pickSeason(key)}
              variant={season === key ? 'inverse' : 'glass'}
              size="pill-sm"
            >
              {seasons[key].label}
            </Button>
          ))}
          {!reduceMotion && (
            <Button
              type="button"
              variant="glass"
              size="icon-pill"
              onClick={() => setPaused((value) => !value)}
              aria-pressed={paused}
              aria-label={paused ? 'Continuar a troca das estações' : 'Pausar a troca das estações'}
              className="size-9"
            >
              {paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
            </Button>
          )}
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
            <h1 className="text-display-xl text-legible">
              <span className="block">{current.headline[0]}</span>
              <span className="block font-light">{current.headline[1]}</span>
            </h1>
            <p className="text-body-l text-primary-foreground/90 text-legible mt-5 max-w-xl text-pretty">
              {current.sub}
            </p>
          </motion.div>
        </AnimatePresence>

        <div
          className="mt-8"
          onPointerEnter={() => setHovering(true)}
          onPointerLeave={() => setHovering(false)}
        >
          <HeroSearchBar season={season} tags={current.tags} trailing={actions} />
          <HeroSearchSheet season={season} tags={current.tags} />
          <div className="mt-5 lg:hidden">{actions}</div>
        </div>
      </Container>
    </section>
  )
}
