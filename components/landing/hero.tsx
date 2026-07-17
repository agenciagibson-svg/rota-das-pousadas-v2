'use client'

import { useState } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'motion/react'
import { Search, MapPin, Calendar, Users, Sparkles, ArrowRight } from 'lucide-react'

type SeasonKey = 'verao' | 'outono' | 'inverno' | 'primavera'

const seasons: Record<
  SeasonKey,
  { label: string; headline: string; sub: string; tags: string[] }
> = {
  verao: {
    label: 'Verão',
    headline: 'Águas cristalinas e dias infinitos',
    sub: 'Praias, piscinas, cachoeiras e esportes aquáticos esperam por você.',
    tags: ['Praia', 'Piscina', 'Cachoeiras', 'Ilhas'],
  },
  outono: {
    label: 'Outono',
    headline: 'Tons dourados e o ritmo bom do campo',
    sub: 'Fazendas, vinhedos e trilhas sob a luz mais bonita do ano.',
    tags: ['Fazenda', 'Vinhos', 'Trilhas', 'Natureza'],
  },
  inverno: {
    label: 'Inverno',
    headline: 'Lareiras acesas e refúgios de serra',
    sub: 'Chalés, vinhos e destinos de montanha para aquecer a alma.',
    tags: ['Chalés', 'Lareira', 'Serra', 'Vinhos'],
  },
  primavera: {
    label: 'Primavera',
    headline: 'A natureza floresce, e você também',
    sub: 'Ecoturismo, jardins e pousadas em meio ao verde renascido.',
    tags: ['Ecoturismo', 'Flores', 'Natureza', 'Bem-estar'],
  },
}

export function Hero() {
  const [season, setSeason] = useState<SeasonKey>('inverno')
  const current = seasons[season]

  return (
    <section className="relative min-h-[100svh] w-full overflow-hidden">
      <Image
        src="/images/hero.png"
        alt="Pousada de luxo na serra brasileira ao pôr do sol com piscina de borda infinita"
        fill
        priority
        className="object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-stone-deep/50 via-stone-deep/25 to-stone-deep/80" />

      <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-7xl flex-col justify-end px-5 pb-10 pt-32 lg:px-8 lg:pb-16">
        {/* Home viva season selector */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="mb-6 flex flex-wrap items-center gap-2"
        >
          <span className="mr-1 inline-flex items-center gap-1.5 rounded-full bg-primary-foreground/10 px-3 py-1.5 text-xs font-medium text-primary-foreground backdrop-blur">
            <Sparkles className="size-3.5 text-gold" />
            Home viva
          </span>
          {(Object.keys(seasons) as SeasonKey[]).map((key) => (
            <button
              key={key}
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
            <h1 className="text-balance font-serif text-4xl font-semibold leading-[1.05] text-primary-foreground sm:text-6xl lg:text-7xl">
              {current.headline}
            </h1>
            <p className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-primary-foreground/85 sm:text-lg">
              {current.sub}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* Search bar */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="glass mt-8 rounded-3xl border border-primary-foreground/20 p-2.5 shadow-2xl shadow-stone-deep/30"
        >
          <div className="grid grid-cols-1 gap-2 md:grid-cols-[1.3fr_1fr_1fr_auto]">
            <SearchField icon={<MapPin className="size-4 text-primary" />} label="Destino" placeholder="Para onde vamos?" />
            <SearchField icon={<Calendar className="size-4 text-primary" />} label="Datas" placeholder="Quando?" />
            <SearchField icon={<Users className="size-4 text-primary" />} label="Hóspedes" placeholder="2 adultos" />
            <button className="group flex items-center justify-center gap-2 rounded-2xl bg-accent px-6 py-3.5 text-sm font-semibold text-accent-foreground transition-all hover:brightness-105 md:px-7">
              <Search className="size-4" />
              Encontrar meu refúgio
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2 px-2 pb-1 pt-3">
            <span className="text-xs font-medium text-foreground/60">Sugestões da estação:</span>
            {current.tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground"
              >
                {t}
              </span>
            ))}
          </div>
        </motion.div>

        <a
          href="#destinos"
          className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-primary-foreground/80 transition-colors hover:text-primary-foreground"
        >
          Explorar destinos em destaque
          <ArrowRight className="size-4" />
        </a>
      </div>
    </section>
  )
}

function SearchField({
  icon,
  label,
  placeholder,
}: {
  icon: React.ReactNode
  label: string
  placeholder: string
}) {
  return (
    <label className="flex cursor-text items-center gap-3 rounded-2xl bg-card px-4 py-2.5 transition-colors hover:bg-card/90">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary">{icon}</span>
      <span className="flex min-w-0 flex-col">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
        <input
          className="w-full bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground/70"
          placeholder={placeholder}
        />
      </span>
    </label>
  )
}
