import Image from 'next/image'
import Link from 'next/link'
import { Star, MapPin } from 'lucide-react'
import type { Pousada } from '@/types'
import { Reveal } from '@/components/reveal'
import { Section } from '@/components/ui/container'
import { Badge } from '@/components/ui/badge'

export function FeaturedPousadas({ pousadas }: { pousadas: Pousada[] }) {
  return (
    <Section id="pousadas" className="py-20 lg:py-28">
      <Reveal>
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <span className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
              Pousadas em destaque
            </span>
            <h2 className="mt-3 text-balance font-serif text-3xl font-semibold leading-tight text-foreground sm:text-5xl">
              Refúgios selecionados a dedo
            </h2>
          </div>
          <Link
            href="/pousadas"
            className="inline-flex w-fit items-center gap-2 rounded-full border border-border px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
          >
            Ver todas as pousadas
          </Link>
        </div>
      </Reveal>

      <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {pousadas.map((p, i) => (
          <Reveal key={p.slug} delay={(i % 4) * 0.08}>
            <Link
              href={`/pousada/${p.slug}`}
              className="group flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-card transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-stone-deep/10"
            >
              <div className="relative aspect-[4/3] overflow-hidden">
                <Image
                  src={p.image || '/placeholder.svg'}
                  alt={p.name}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                />
                <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full glass px-3 py-1 text-xs font-semibold text-foreground">
                  <Star className="size-3.5 fill-gold text-gold" />
                  {p.rating.toFixed(1)}
                </span>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <MapPin className="size-3.5" />
                  {p.city}, {p.state}
                </div>
                <h3 className="mt-2 font-serif text-xl font-semibold leading-tight text-foreground">
                  {p.name}
                </h3>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {p.tags.slice(0, 2).map((t) => (
                    <Badge key={t} variant="secondary" size="sm">
                      {t}
                    </Badge>
                  ))}
                </div>
                <div className="mt-auto flex items-end justify-between pt-5">
                  <div>
                    <span className="text-lg font-semibold text-foreground">R$ {p.pricePerNight}</span>
                    <span className="text-xs text-muted-foreground"> / diária</span>
                  </div>
                  <span className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors group-hover:bg-accent group-hover:text-accent-foreground">
                    Ver detalhes
                  </span>
                </div>
              </div>
            </Link>
          </Reveal>
        ))}
      </div>
    </Section>
  )
}
