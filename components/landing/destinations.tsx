import Image from 'next/image'
import Link from 'next/link'
import { Star, MapPin, ArrowUpRight } from 'lucide-react'
import { destinations } from '@/lib/data'
import { Reveal } from '@/components/reveal'

export function Destinations() {
  return (
    <section id="destinos" className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28">
      <Reveal>
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <span className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
              Destinos em destaque
            </span>
            <h2 className="mt-3 text-balance font-serif text-3xl font-semibold leading-tight text-foreground sm:text-5xl">
              Onde o Brasil respira mais fundo
            </h2>
          </div>
          <p className="max-w-sm text-pretty text-sm leading-relaxed text-muted-foreground">
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
                <div className="absolute inset-0 bg-gradient-to-t from-stone-deep/85 via-stone-deep/10 to-transparent" />

                <div className="absolute right-4 top-4 flex size-10 items-center justify-center rounded-full bg-primary-foreground/15 text-primary-foreground opacity-0 backdrop-blur transition-all duration-500 group-hover:opacity-100">
                  <ArrowUpRight className="size-5" />
                </div>

                <div className="absolute inset-x-0 bottom-0 p-5 lg:p-7">
                  <div className="flex items-center gap-2 text-xs font-medium text-primary-foreground/80">
                    <MapPin className="size-3.5" />
                    {d.state}
                    <span className="mx-1 opacity-50">•</span>
                    {d.pousadas} pousadas
                  </div>
                  <h3 className={`mt-2 font-serif font-semibold text-primary-foreground ${featured ? 'text-3xl lg:text-4xl' : 'text-2xl'}`}>
                    {d.name}
                  </h3>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-foreground/15 px-3 py-1 text-xs font-semibold text-primary-foreground backdrop-blur">
                      <Star className="size-3.5 fill-gold text-gold" />
                      {d.rating.toFixed(1)}
                    </span>
                    <span className="text-sm font-medium text-primary-foreground/90">
                      A partir de <span className="font-semibold">R$ {d.priceFrom}</span>
                    </span>
                  </div>
                </div>
              </Link>
            </Reveal>
          )
        })}
      </div>
    </section>
  )
}
