'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Camera, HeartHandshake, Play, Sparkles } from 'lucide-react'
import { Logo } from '@/components/brand/logo'

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
    <div className="relative">
      <div className="relative">
        <div>
          <Logo className="text-linen h-7" />
          <p className="text-linen/45 mt-3 text-xs font-semibold">Passaporte vivo</p>
        </div>

        <div className="border-linen/10 bg-stone-deep/55 mt-6 rounded-xl border p-4">
          <span className="text-ipe inline-flex items-center gap-2 text-xs font-semibold">
            <HeartHandshake className="size-4" />
            Toda grande viagem começa por uma rota
          </span>
          <p className="text-linen mt-3 font-serif text-2xl leading-tight font-semibold text-pretty">
            Um ecossistema para descobrir, reservar e contar histórias de pousadas brasileiras.
          </p>

          <div className="mt-5 grid grid-cols-3 gap-2">
            {['curadoria', 'reserva', 'gestão'].map((item, index) => (
              <div key={item} className="border-linen/10 bg-linen/[0.04] rounded-lg border p-3">
                <div className="text-linen text-lg font-semibold">{index + 1}</div>
                <div className="text-linen/45 mt-1 text-xs">{item}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-linen/10 bg-linen/[0.04] mt-5 rounded-xl border p-3">
          <div className="flex items-center gap-3">
            <span className="bg-linen text-stone-deep flex size-10 shrink-0 items-center justify-center rounded-full">
              <ActiveIcon className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-linen text-sm font-semibold">{active.stat}</p>
              <p className="text-linen/55 mt-0.5 text-xs leading-relaxed">{active.pulse}</p>
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
                <ArrowUpRight className="size-3 opacity-70 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
