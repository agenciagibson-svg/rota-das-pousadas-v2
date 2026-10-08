'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'motion/react'
import { ArrowUpRight, Compass, Hotel, Map, Route, Sparkles, Tags } from 'lucide-react'

const routes = [
  {
    label: 'Destinos',
    href: '/#destinos',
    image: '/images/canastra.png',
    icon: Map,
    kicker: 'Comece pelo mapa',
    title: 'Serra, praia ou cerrado?',
    detail:
      'Passe pelas paisagens e deixe a rota apontar para o tipo de viagem que combina com o seu momento.',
    tone: 'text-liquen',
  },
  {
    label: 'Experiências',
    href: '/#experiencias',
    image: '/images/experience.png',
    icon: Sparkles,
    kicker: 'Escolha pelo clima',
    title: 'Natureza, luxo, romance ou aventura.',
    detail: 'A navegação sai do comum: primeiro a sensação da viagem, depois a pousada ideal.',
    tone: 'text-liquen',
  },
  {
    label: 'Pousadas',
    href: '/pousadas',
    image: '/images/pousada-1.png',
    icon: Hotel,
    kicker: 'Veja a sequência completa',
    title: 'Todas as pousadas em uma trilha visual.',
    detail: 'Abra qualquer pousada para ver o slide de fotos e reservar logo abaixo.',
    tone: 'text-liquen',
  },
  {
    label: 'Ofertas',
    href: '/pousadas',
    image: '/images/capitolio.png',
    icon: Tags,
    kicker: 'Próxima camada',
    title: 'Datas boas merecem ofertas vivas.',
    detail: 'A base já leva para as pousadas; depois encaixamos preços dinâmicos por temporada.',
    tone: 'text-liquen',
  },
  {
    label: 'Roteiros',
    href: '/#editorial',
    image: '/images/jalapao.png',
    icon: Route,
    kicker: 'Monte uma jornada',
    title: 'Uma rota, várias pousadas, zero planilha.',
    detail:
      'A ideia é evoluir para roteiros combinados, com pernoites sugeridos e distâncias inteligentes.',
    tone: 'text-liquen',
  },
]

export function FooterExploreCard() {
  const [activeIndex, setActiveIndex] = useState(0)
  const active = routes[activeIndex]
  const ActiveIcon = active.icon

  function spinRoute() {
    setActiveIndex((current) => (current + 1) % routes.length)
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4 className="text-linen text-sm font-semibold">Explorar</h4>
          <p className="text-linen/55 mt-1 text-xs leading-relaxed">Bussola de rotas interativa</p>
        </div>
        <button
          type="button"
          onClick={spinRoute}
          className="border-linen/15 text-linen hover:bg-linen hover:text-stone-deep flex size-10 shrink-0 items-center justify-center rounded-full border transition-colors"
          aria-label="Girar bussola de rotas"
        >
          <Compass className="size-5" />
        </button>
      </div>

      <div className="border-linen/10 bg-stone-deep relative mt-4 overflow-hidden rounded-xl border">
        <div className="relative aspect-[5/3] min-h-44">
          <Image
            key={active.image}
            src={active.image}
            alt={active.title}
            fill
            sizes="(max-width: 1024px) 100vw, 300px"
            className="object-cover opacity-75 transition-opacity duration-[var(--motion-page)]"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(31,36,32,0.08),rgba(31,36,32,0.88))]" />
          <svg className="absolute inset-0 size-full" viewBox="0 0 320 190" aria-hidden="true">
            <motion.path
              key={active.label}
              d="M22 148 C84 82, 126 174, 176 88 S260 34, 298 116"
              fill="none"
              stroke="rgba(248,246,241,0.82)"
              strokeLinecap="round"
              strokeWidth="3"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            />
            {[22, 176, 298].map((x, index) => (
              <motion.circle
                key={`${active.label}-${index}`}
                cx={x}
                cy={[148, 88, 116][index]}
                r="5"
                fill="rgb(248,246,241)"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.12 + index * 0.08 }}
              />
            ))}
          </svg>
          <div className="absolute inset-x-0 bottom-0 p-4">
            <span className={`inline-flex items-center gap-2 text-xs font-semibold ${active.tone}`}>
              <ActiveIcon className="size-4" />
              {active.kicker}
            </span>
            <p className="text-linen mt-2 font-serif text-xl leading-tight font-semibold text-pretty">
              {active.title}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-5 gap-2">
        {routes.map((route, index) => {
          const Icon = route.icon
          const selected = activeIndex === index
          return (
            <button
              key={route.label}
              type="button"
              onClick={() => setActiveIndex(index)}
              onMouseEnter={() => setActiveIndex(index)}
              onFocus={() => setActiveIndex(index)}
              aria-label={`Explorar ${route.label}`}
              className={`flex h-11 items-center justify-center rounded-xl border transition-all ${
                selected
                  ? 'border-linen/35 bg-linen text-stone-deep'
                  : 'border-linen/10 text-linen/55 hover:border-linen/25 hover:text-linen'
              }`}
            >
              <Icon className="size-4" />
            </button>
          )
        })}
      </div>

      <p className="text-linen/65 mt-4 min-h-12 text-sm leading-relaxed">{active.detail}</p>

      <Link
        href={active.href}
        className="bg-linen text-stone-deep hover:bg-accent hover:text-accent-foreground mt-4 inline-flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold transition-colors"
      >
        Abrir {active.label}
        <ArrowUpRight className="size-4" />
      </Link>
    </div>
  )
}
