'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
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
import type { Experience } from '@/types'
import { Reveal } from '@/components/reveal'
import { Button, buttonVariants } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import { SectionHeading } from '@/components/ui/section-heading'
import { cn } from '@/lib/utils'

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

/**
 * As experiências viram uma faixa de pílulas (no lugar de 12 cards iguais
 * com ícone). A pílula escolhida abre, ao lado, a descrição e o atalho para
 * as pousadas daquele estilo — um ícone só, no painel, não em cada item.
 */
export function Experiences({ experiences }: { experiences: Experience[] }) {
  const [selected, setSelected] = useState(0)
  const current = experiences[selected]
  if (!current) return null
  const Icon = iconMap[current.icon] ?? House

  return (
    <section id="experiencias" className="py-12 lg:py-16">
      <Container>
        <Reveal>
          <SectionHeading
            eyebrow="Experiências"
            title="Viaje pelo que você sente"
            description="Não escolha apenas um lugar. Escolha um estado de espírito e deixe a rota se desenhar a partir dele."
          />
        </Reveal>

        <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
          <div
            role="group"
            aria-label="Experiências"
            className="-mx-5 flex [scrollbar-width:none] gap-2 overflow-x-auto px-5 pb-2 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0"
          >
            {experiences.map((exp, i) => (
              <Button
                key={exp.slug}
                type="button"
                aria-pressed={selected === i}
                onClick={() => setSelected(i)}
                variant={selected === i ? 'default' : 'outline'}
                size="pill"
                className={cn('shrink-0', selected !== i && 'bg-card')}
              >
                {exp.name}
              </Button>
            ))}
          </div>

          <div
            aria-live="polite"
            className="bg-breu text-neblina flex min-h-56 flex-col rounded-3xl p-6 lg:p-8"
          >
            <Icon className="text-ipe size-6" />
            <p className="text-h2 mt-6">{current.name}</p>
            <p className="text-liquen mt-2 text-base leading-relaxed">{current.description}</p>
            <Link
              href={`/pousadas?busca=${encodeURIComponent(current.name)}`}
              className={cn(buttonVariants({ variant: 'inverse', size: 'pill' }), 'mt-6 w-fit')}
            >
              Ver pousadas
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </Container>
    </section>
  )
}
