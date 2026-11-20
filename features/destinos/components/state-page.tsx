import Image from 'next/image'
import Link from 'next/link'
import { PousadaCard } from '@/components/pousada/pousada-card'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { JsonLd } from '@/components/seo/json-ld'
import { formatPrice } from '@/lib/format'
import { cn } from '@/lib/utils'
import { stateIntro, stateTitle, type StateDestination } from '../destinos'
import { stateJsonLd } from '../seo'

/**
 * Página do estado (/destinos/mg): as cidades com foto e as pousadas mais
 * avaliadas. `cityPhoto` resolve a capa de cada cidade (admin → guia → pousada).
 */
export function StatePage({
  state,
  cityPhoto,
}: {
  state: StateDestination
  cityPhoto: (slug: string) => string
}) {
  const top = state.cities
    .flatMap((c) => c.pousadas)
    .sort((a, b) => b.reviews - a.reviews || b.rating - a.rating)
    .slice(0, 6)

  return (
    <>
      <JsonLd data={stateJsonLd(state)} />
      <Breadcrumb
        items={[
          { label: 'Início', href: '/' },
          { label: 'Destinos', href: '/destinos' },
          { label: state.name },
        ]}
      />

      <header className="mt-6 max-w-3xl">
        <h1 className="text-display-l text-foreground text-balance">{stateTitle(state)}</h1>
        <p className="text-muted-foreground mt-4 text-lg leading-relaxed text-pretty">
          {stateIntro(state)}
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Badge variant="outline" size="lg" className="bg-card border-transparent">
            {state.cities.length === 1 ? '1 cidade' : `${state.cities.length} cidades`}
          </Badge>
          <Badge variant="outline" size="lg" className="bg-card border-transparent">
            {state.pousadas === 1 ? '1 pousada' : `${state.pousadas} pousadas`}
          </Badge>
          {state.priceFrom > 0 && (
            <Badge variant="outline" size="lg" className="bg-card border-transparent">
              A partir de {formatPrice(state.priceFrom)}
            </Badge>
          )}
        </div>
      </header>

      <section aria-labelledby="cidades" className="mt-12">
        <h2 id="cidades" className="text-h2 text-foreground">
          Cidades em {state.name}
        </h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {state.cities.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/destinos/${c.slug}`}
                className="group relative block aspect-[4/3] overflow-hidden rounded-3xl"
              >
                <Image
                  src={cityPhoto(c.slug) || '/placeholder.svg'}
                  alt={`Pousadas em ${c.city}, ${c.state}`}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover transition-transform duration-(--motion-reveal) group-hover:scale-105"
                />
                <div className="from-breu/85 via-breu/10 absolute inset-0 bg-gradient-to-t to-transparent" />
                <div className="text-primary-foreground absolute inset-x-0 bottom-0 p-5">
                  <h3 className="text-h3">{c.city}</h3>
                  <p className="text-primary-foreground/85 mt-1 text-sm">
                    {c.pousadas.length === 1 ? '1 pousada' : `${c.pousadas.length} pousadas`}
                    {c.priceFrom > 0 ? ` · a partir de ${formatPrice(c.priceFrom)}` : ''}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="destaques" className="mt-14">
        <h2 id="destaques" className="text-h2 text-foreground">
          Pousadas em destaque em {state.name}
        </h2>
        <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {top.map((pousada) => (
            <li key={pousada.slug}>
              <PousadaCard
                pousada={pousada}
                href={`/pousada/${pousada.slug}`}
                cta="Ver pousada"
                showDescription
                showReviews
                maxTags={4}
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              />
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-12">
        <Link href="/destinos" className={cn(buttonVariants({ size: 'pill' }), 'w-fit')}>
          Ver todos os destinos
        </Link>
      </div>
    </>
  )
}
