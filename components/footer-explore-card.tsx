'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion, useReducedMotion } from 'motion/react'
import { ArrowUpRight, Compass } from 'lucide-react'
import { routes } from '@/components/footer-links'

export function FooterExploreCard() {
  const [activeIndex, setActiveIndex] = useState(0)
  const active = routes[activeIndex]
  const ActiveIcon = active.icon
  // O traçado da rota "se desenha"; com movimento reduzido, aparece pronto.
  const reduceMotion = useReducedMotion()

  function spinRoute() {
    setActiveIndex((current) => (current + 1) % routes.length)
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-linen text-sm font-semibold">Explorar</h2>
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
          <div className="from-breu/10 to-breu/90 absolute inset-0 bg-gradient-to-b" />
          <svg className="absolute inset-0 size-full" viewBox="0 0 320 190" aria-hidden="true">
            <motion.path
              key={active.label}
              d="M22 148 C84 82, 126 174, 176 88 S260 34, 298 116"
              fill="none"
              className="stroke-neblina/80"
              strokeLinecap="round"
              strokeWidth="3"
              initial={reduceMotion ? false : { pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            />
            {[22, 176, 298].map((x, index) => (
              <motion.circle
                key={`${active.label}-${index}`}
                cx={x}
                cy={[148, 88, 116][index]}
                r="5"
                // O último ponto é a chegada: Ipê, como o ponto da logo.
                className={index === 2 ? 'fill-ipe' : 'fill-neblina'}
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
            <p className="text-linen font-display mt-2 text-xl leading-tight font-medium text-pretty">
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
              aria-pressed={selected}
              className={`flex h-11 items-center justify-center rounded-xl border transition ${
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

      <p aria-live="polite" className="text-linen/65 mt-4 min-h-12 text-sm leading-relaxed">
        {active.detail}
      </p>

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
