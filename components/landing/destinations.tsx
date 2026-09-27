import Image from 'next/image'
import Link from 'next/link'
import { Star, MapPin, ArrowUpRight } from 'lucide-react'
import type { Destination } from '@/types'
import { Reveal } from '@/components/reveal'
import { Section } from '@/components/ui/container'
import { formatPrice } from '@/lib/format'

export function Destinations({ destinations }: { destinations: Destination[] }) {
  return (
    <Section id="destinos" className="py-20 lg:py-28">
      <Reveal>
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <span className="text-primary text-sm font-semibold tracking-[0.2em] uppercase">
              Destinos em destaque
            </span>
            <h2 className="text-foreground mt-3 font-serif text-3xl leading-tight font-semibold text-balance sm:text-5xl">
              Onde o Brasil respira mais fundo
            </h2>
          </div>
          <p className="text-muted-foreground max-w-sm text-sm leading-relaxed text-pretty">
            Curadoria de lugares que valem a viagem — da serra mineira às águas de Noronha, cada
            rota é um convite à descoberta.
          </p>
        </div>
      </Reveal>

      <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {destinations.map((d, i) => {
          const featured = i === 0
          return (
            <Reveal
              key={d.slug}
              delay={(i % 3) * 0.08}
              className={featured ? 'sm:col-span-2 lg:row-span-2' : ''}
            >
              <Link
                href={`/pousada/refugio-das-nuvens`}
                className={`group relative block h-full overflow-hidden rounded-3xl ${
                  featured ? 'min-h-[320px] lg:min-h-[560px]' : 'min-h-[300px]'
                }`}
              >
                <Image
                  src={d.image || '/placeholder.svg'}
                  alt={`${d.name}, ${d.state}`}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                />
                <div className="from-stone-deep/85 via-stone-deep/10 absolute inset-0 bg-gradient-to-t to-transparent" />

                <div className="bg-primary-foreground/15 text-primary-foreground absolute top-4 right-4 flex size-10 items-center justify-center rounded-full opacity-0 backdrop-blur transition-all duration-500 group-hover:opacity-100">
                  <ArrowUpRight className="size-5" />
                </div>

                <div className="absolute inset-x-0 bottom-0 p-5 lg:p-7">
                  <div className="text-primary-foreground/80 flex items-center gap-2 text-xs font-medium">
                    <MapPin className="size-3.5" />
                    {d.state}
                    <span className="mx-1 opacity-50">•</span>
                    {d.pousadas} pousadas
                  </div>
                  <h3
                    className={`text-primary-foreground mt-2 font-serif font-semibold ${featured ? 'text-3xl lg:text-4xl' : 'text-2xl'}`}
                  >
                    {d.name}
                  </h3>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="bg-primary-foreground/15 text-primary-foreground inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold backdrop-blur">
                      <Star className="fill-gold text-gold size-3.5" />
                      {d.rating.toFixed(1)}
                    </span>
                    <span className="text-primary-foreground/90 text-sm font-medium">
                      A partir de <span className="font-semibold">{formatPrice(d.priceFrom)}</span>
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
