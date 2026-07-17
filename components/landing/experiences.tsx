'use client'

import {
  Heart,
  Trees,
  Gem,
  PawPrint,
  WavesLadder,
  Droplets,
  Wheat,
  Tent,
  Leaf,
  Mountain,
  Sun,
  House,
  type LucideIcon,
} from 'lucide-react'
import { experiences } from '@/lib/data'
import { Reveal } from '@/components/reveal'

const iconMap: Record<string, LucideIcon> = {
  Heart,
  Trees,
  Gem,
  PawPrint,
  WavesLadder,
  Droplets,
  Wheat,
  Tent,
  Leaf,
  Mountain,
  Sun,
  House,
}

export function Experiences() {
  return (
    <section id="experiencias" className="bg-secondary/50 py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <Reveal>
          <div className="max-w-2xl">
            <span className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
              Experiências
            </span>
            <h2 className="mt-3 text-balance font-serif text-3xl font-semibold leading-tight text-foreground sm:text-5xl">
              Viaje pelo que você sente
            </h2>
            <p className="mt-4 max-w-lg text-pretty text-sm leading-relaxed text-muted-foreground">
              Não escolha apenas um lugar. Escolha um estado de espírito e deixe a rota se desenhar a
              partir dele.
            </p>
          </div>
        </Reveal>

        <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {experiences.map((exp, i) => {
            const Icon = iconMap[exp.icon] ?? House
            return (
              <Reveal key={exp.slug} delay={(i % 4) * 0.06}>
                <button className="group flex h-full w-full flex-col items-start gap-4 rounded-2xl border border-border bg-card p-5 text-left transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5">
                  <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon className="size-6" />
                  </span>
                  <div>
                    <h3 className="text-base font-semibold text-foreground">{exp.name}</h3>
                    <p className="mt-1 text-sm leading-snug text-muted-foreground">{exp.description}</p>
                  </div>
                </button>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}
