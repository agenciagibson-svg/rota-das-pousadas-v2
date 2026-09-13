'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'motion/react'
import { ArrowUpRight, Camera, Compass, HeartHandshake, Play, Sparkles } from 'lucide-react'

const channels = [
  {
    label: 'Instagram',
    href: '#',
    icon: Camera,
    pulse: 'Stories de pousadas reais, bastidores e achados pelo Brasil.',
    stat: '180 destinos',
  },
  {
    label: 'YouTube',
    href: '#',
    icon: Play,
    pulse: 'Roteiros em vídeo, reviews de hospedagens e guias por temporada.',
    stat: 'Rotas em vídeo',
  },
  {
    label: 'TikTok',
    href: '#',
    icon: Sparkles,
    pulse: 'Descobertas rápidas, lugares escondidos e ideias para viajar agora.',
    stat: 'Achados virais',
  },
]

export function FooterBrandCard() {
  const [activeIndex, setActiveIndex] = useState(0)
  const active = channels[activeIndex]
  const ActiveIcon = active.icon

  return (
    <div className="relative overflow-hidden rounded-2xl border border-linen/10 bg-linen/[0.06] p-5 shadow-floating">
      <div className="pointer-events-none absolute right-4 top-4 size-24 rounded-full border border-linen/10" />
      <div className="pointer-events-none absolute right-8 top-8 size-12 rounded-full border border-linen/10" />

      <div className="relative">
        <div className="flex items-center gap-3">
          <motion.span
            className="relative flex size-12 items-center justify-center rounded-full bg-linen text-primary"
            animate={{ rotate: [0, 8, -6, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Compass className="size-6" />
            <span className="absolute -right-1 -top-1 flex size-4 rounded-full bg-accent ring-4 ring-stone-deep" />
          </motion.span>
          <div>
            <span className="font-serif text-xl font-semibold leading-none text-linen">
              Rota das Pousadas
            </span>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-linen/45">
              Passaporte vivo
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-linen/10 bg-stone-deep/55 p-4">
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-gold">
            <HeartHandshake className="size-4" />
            Toda grande viagem começa por uma rota
          </span>
          <p className="mt-3 text-pretty font-serif text-2xl font-semibold leading-tight text-linen">
            Um ecossistema para descobrir, reservar e contar histórias de pousadas brasileiras.
          </p>

          <div className="mt-5 grid grid-cols-3 gap-2">
            {['curadoria', 'reserva', 'gestão'].map((item, index) => (
              <div key={item} className="rounded-lg border border-linen/10 bg-linen/[0.04] p-3">
                <div className="text-lg font-semibold text-linen">{index + 1}</div>
                <div className="mt-1 text-[11px] uppercase tracking-wide text-linen/45">{item}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-linen/10 bg-linen/[0.04] p-3">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-linen text-stone-deep">
              <ActiveIcon className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-linen">{active.stat}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-linen/55">{active.pulse}</p>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {channels.map((channel, index) => {
            const selected = activeIndex === index
            return (
              <Link
                key={channel.label}
                href={channel.href}
                onMouseEnter={() => setActiveIndex(index)}
                onFocus={() => setActiveIndex(index)}
                onClick={() => setActiveIndex(index)}
                className={`group inline-flex items-center justify-center gap-1 rounded-full border px-3 py-2 text-xs font-semibold transition-all ${
                  selected
                    ? 'border-linen bg-linen text-stone-deep'
                    : 'border-linen/15 text-linen/70 hover:border-linen/35 hover:text-linen'
                }`}
              >
                {channel.label}
                <ArrowUpRight className="size-3 opacity-70 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
