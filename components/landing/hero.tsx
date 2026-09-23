'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'motion/react'
import { Search, MapPin, Calendar, Users, Sparkles, ArrowRight, Shuffle } from 'lucide-react'
import { SearchField } from '@/components/ui/search-field'

type SeasonKey = 'verao' | 'outono' | 'inverno' | 'primavera'

const seasons: Record<
  SeasonKey,
  {
    label: string
    headline: string
    sub: string
    tags: string[]
    image: string
    alt: string
  }
> = {
  verao: {
    label: 'Verão',
    headline: 'Águas cristalinas e dias infinitos',
    sub: 'Praias, piscinas, cachoeiras e esportes aquáticos esperam por você.',
    tags: ['Praia', 'Piscina', 'Cachoeiras', 'Ilhas'],
    image: '/images/noronha.png',
    alt: 'Praia brasileira com mar azul para viagens de verao',
  },
  outono: {
    label: 'Outono',
    headline: 'Tons dourados e o ritmo bom do campo',
    sub: 'Fazendas, vinhedos e trilhas sob a luz mais bonita do ano.',
    tags: ['Fazenda', 'Vinhos', 'Trilhas', 'Natureza'],
    image: '/images/canastra.png',
    alt: 'Paisagem de serra e natureza para viagens de outono',
  },
  inverno: {
    label: 'Inverno',
    headline: 'Lareiras acesas e refúgios de serra',
    sub: 'Chalés, vinhos e destinos de montanha para aquecer a alma.',
    tags: ['Chalés', 'Lareira', 'Serra', 'Vinhos'],
    image: '/images/gramado.png',
    alt: 'Destino de inverno com arquitetura aconchegante na serra',
  },
  primavera: {
    label: 'Primavera',
    headline: 'A natureza floresce, e você também',
    sub: 'Ecoturismo, jardins e pousadas em meio ao verde renascido.',
    tags: ['Ecoturismo', 'Flores', 'Natureza', 'Bem-estar'],
    image: '/images/hero.png',
    alt: 'Pousada em meio a natureza verde ao nascer do sol',
  },
}

const surpriseRoutes: Record<SeasonKey, string[]> = {
  verao: ['Praia', 'Piscina', 'Cachoeiras', 'Noronha', 'Capitólio', 'Bonito'],
  outono: ['Natureza', 'Fazenda', 'Trilhas', 'Canastra', 'Vista', 'Ecoturismo'],
  inverno: ['Serra', 'Lareira', 'Chalés', 'Gramado', 'Monte Verde', 'Românticos'],
  primavera: ['Ecoturismo', 'Flores', 'Natureza', 'Bem-estar', 'Bonito', 'Canastra'],
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

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function Hero() {
  const router = useRouter()
  const [season, setSeason] = useState<SeasonKey>(() => getCurrentBrazilSeason())
  const current = seasons[season]
  const today = todayIso()
  const tomorrow = addDays(today, 1)
  const dayAfterTomorrow = addDays(today, 2)

  function openSurpriseRoute() {
    const options = surpriseRoutes[season]
    const query = options[Math.floor(Math.random() * options.length)]
    const params = new URLSearchParams({
      busca: query,
      checkin: tomorrow,
      checkout: dayAfterTomorrow,
      hospedes: '2',
      temporada: season,
      surpresa: '1',
    })
    router.push(`/pousadas?${params.toString()}`)
  }

  return (
    <section className="relative min-h-[100svh] w-full overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={current.image}
          initial={{ opacity: 0, scale: 1.02 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.01 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0"
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
      <div className="from-stone-deep/50 via-stone-deep/25 to-stone-deep/80 absolute inset-0 bg-gradient-to-b" />

      <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-7xl flex-col justify-end px-5 pt-32 pb-10 lg:px-8 lg:pb-16">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="mb-6 flex flex-wrap items-center gap-2"
        >
          <span className="bg-primary-foreground/10 text-primary-foreground mr-1 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium backdrop-blur">
            <Sparkles className="text-gold size-3.5" />
            Home viva
          </span>
          {(Object.keys(seasons) as SeasonKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setSeason(key)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                season === key
                  ? 'bg-primary-foreground text-stone-deep'
                  : 'bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20'
              }`}
            >
              {seasons[key].label}
            </button>
          ))}
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div
            key={season}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-3xl"
          >
            <h1 className="text-primary-foreground font-serif text-4xl leading-[1.05] font-semibold text-balance sm:text-6xl lg:text-7xl">
              {current.headline}
            </h1>
            <p className="text-primary-foreground/85 mt-5 max-w-xl text-base leading-relaxed text-pretty sm:text-lg">
              {current.sub}
            </p>
          </motion.div>
        </AnimatePresence>

        <motion.form
          action="/pousadas"
          method="get"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="glass border-primary-foreground/20 shadow-stone-deep/30 mt-8 rounded-3xl border p-2.5 shadow-2xl"
        >
          <input type="hidden" name="temporada" value={season} />
          <div className="grid grid-cols-1 gap-2 md:grid-cols-[1.25fr_0.95fr_0.95fr_0.8fr_auto]">
            <SearchField
              icon={<MapPin className="text-primary size-4" />}
              label="Destino"
              name="busca"
              placeholder="Cidade, pousada ou estilo"
              autoComplete="off"
            />
            <SearchField
              icon={<Calendar className="text-primary size-4" />}
              label="Check-in"
              name="checkin"
              type="date"
              min={today}
              defaultValue={tomorrow}
            />
            <SearchField
              icon={<Calendar className="text-primary size-4" />}
              label="Check-out"
              name="checkout"
              type="date"
              min={dayAfterTomorrow}
              defaultValue={dayAfterTomorrow}
            />
            <SearchField
              icon={<Users className="text-primary size-4" />}
              label="Hóspedes"
              name="hospedes"
              type="number"
              min={1}
              max={12}
              defaultValue={2}
            />
            <button
              type="submit"
              className="group bg-accent text-accent-foreground flex items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-semibold transition-all hover:brightness-105 md:px-7"
            >
              <Search className="size-4" />
              Encontrar meu refúgio
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2 px-2 pt-3 pb-1">
            <span className="text-foreground/60 text-xs font-medium">Sugestões da estação:</span>
            {current.tags.map((tag) => (
              <button
                key={tag}
                type="submit"
                name="busca"
                value={tag}
                className="bg-secondary text-secondary-foreground inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium"
              >
                {tag}
              </button>
            ))}
          </div>
        </motion.form>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={openSurpriseRoute}
            className="bg-primary-foreground text-stone-deep hover:bg-accent hover:text-accent-foreground inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition-all"
          >
            <Shuffle className="size-4" />
            Rota surpresa
          </button>
          <a
            href="#destinos"
            className="text-primary-foreground/80 hover:text-primary-foreground inline-flex items-center gap-2 text-sm font-medium transition-colors"
          >
            Explorar destinos em destaque
            <ArrowRight className="size-4" />
          </a>
        </div>
      </div>
    </section>
  )
}
