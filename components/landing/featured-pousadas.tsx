import Image from 'next/image'
import Link from 'next/link'
import { Star, MapPin } from 'lucide-react'
import type { Pousada } from '@/types'
import { Reveal } from '@/components/reveal'
import { Section } from '@/components/ui/container'
import { Badge } from '@/components/ui/badge'
import { formatPrice } from '@/lib/format'

export function FeaturedPousadas({ pousadas }: { pousadas: Pousada[] }) {
  return (
    <Section id="pousadas" className="py-20 lg:py-28">
      <Reveal>
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <span className="text-primary text-sm font-semibold tracking-[0.2em] uppercase">
              Pousadas em destaque
            </span>
            <h2 className="text-foreground mt-3 font-serif text-3xl leading-tight font-semibold text-balance sm:text-5xl">
              Refúgios selecionados a dedo
            </h2>
          </div>
          <Link
            href="/pousadas"
            className="border-border text-foreground hover:bg-secondary inline-flex w-fit items-center gap-2 rounded-full border px-5 py-3 text-sm font-semibold transition-colors"
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
              className="group border-border bg-card hover:shadow-stone-deep/10 flex h-full flex-col overflow-hidden rounded-3xl border transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl"
            >
              <div className="relative aspect-[4/3] overflow-hidden">
                <Image
                  src={p.image || '/placeholder.svg'}
                  alt={p.name}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                />
                <span className="glass text-foreground absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold">
                  <Star className="fill-gold text-gold size-3.5" />
                  {p.rating.toFixed(1)}
                </span>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <div className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
                  <MapPin className="size-3.5" />
                  {p.city}, {p.state}
                </div>
                <h3 className="text-foreground mt-2 font-serif text-xl leading-tight font-semibold">
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
                    <span className="text-foreground text-lg font-semibold">
                      {formatPrice(p.pricePerNight)}
                    </span>
                    <span className="text-muted-foreground text-xs"> / diária</span>
                  </div>
                  <span className="bg-primary text-primary-foreground group-hover:bg-accent group-hover:text-accent-foreground rounded-full px-4 py-2 text-xs font-semibold transition-colors">
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
