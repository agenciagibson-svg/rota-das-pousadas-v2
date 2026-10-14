import Image from 'next/image'
import Link from 'next/link'
import { Star } from 'lucide-react'
import type { Destination } from '@/types'
import { Reveal } from '@/components/reveal'
import { Badge } from '@/components/ui/badge'
import { Section } from '@/components/ui/container'
import { SectionHeading } from '@/components/ui/section-heading'
import { formatPrice } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Posição de cada foto no mosaico: a primeira é a grande; a sexta, a larga. */
function tileLayout(index: number) {
  if (index === 0) return 'col-span-2 row-span-2 min-h-80 lg:min-h-0'
  if (index === 5) return 'col-span-2 min-h-56 lg:min-h-0'
  return 'min-h-56 lg:min-h-0'
}

/**
 * Mosaico de destinos: a foto manda, o texto fica embaixo sobre a sombra. Em
 * vez de cards iguais, tamanhos diferentes dão ritmo à seção.
 */
export function Destinations({ destinations }: { destinations: Destination[] }) {
  return (
    <Section id="destinos" className="pt-12 pb-16 lg:pt-16 lg:pb-24">
      <Reveal>
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <SectionHeading eyebrow="Destinos em destaque" title="Onde o Brasil respira mais fundo" />
          <p className="text-muted-foreground max-w-sm text-base leading-relaxed text-pretty">
            Curadoria de lugares que valem a viagem — da serra mineira às águas de Noronha, cada
            rota é um convite à descoberta.
          </p>
        </div>
      </Reveal>

      <div className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 lg:auto-rows-[15rem] lg:grid-cols-4">
        {destinations.map((d, i) => {
          const featured = i === 0
          return (
            <Reveal key={d.slug} delay={(i % 4) * 0.06} className={tileLayout(i)}>
              <Link
                href={`/pousada/refugio-das-nuvens`}
                className="group relative block h-full overflow-hidden rounded-3xl"
              >
                <Image
                  src={d.image || '/placeholder.svg'}
                  alt={`${d.name}, ${d.state}`}
                  fill
                  sizes={
                    featured ? '(max-width: 1024px) 100vw, 50vw' : '(max-width: 1024px) 50vw, 25vw'
                  }
                  className="object-cover transition-transform duration-(--motion-reveal) group-hover:scale-105"
                />
                <div className="from-breu/85 via-breu/10 absolute inset-0 bg-gradient-to-t to-transparent" />

                <div className="text-primary-foreground absolute inset-x-0 bottom-0 flex flex-col gap-1 p-4 lg:p-6">
                  <span className="text-primary-foreground/80 text-xs font-medium">
                    {d.state} · {d.pousadas} pousadas
                  </span>
                  <h3 className={cn(featured ? 'text-h1' : 'text-h3')}>{d.name}</h3>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge variant="glass" size="sm" className="tabular-nums">
                      <Star className="fill-ipe text-ipe size-3" />
                      {d.rating.toFixed(1)}
                    </Badge>
                    <span className="text-primary-foreground/90 text-xs font-medium sm:text-sm">
                      A partir de{' '}
                      <span className="font-semibold tabular-nums">{formatPrice(d.priceFrom)}</span>
                    </span>
                  </div>
                </div>
              </Link>
            </Reveal>
          )
        })}
      </div>
    </Section>
  )
}
