import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Star } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { PousadaCard } from '@/components/pousada/pousada-card'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { JsonLd } from '@/components/seo/json-ld'
import { absoluteUrl } from '@/lib/seo'
import { formatPrice } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  getCityDestination,
  getCityDestinations,
  getDestinations,
  getStateDestination,
} from '@/server/queries'
import {
  cityPhoto,
  destinationDescription,
  destinationFaq,
  destinationIntro,
  destinationJsonLd,
  destinationTitle,
  isStateSlug,
  stateDescription,
  stateIndexable,
  stateTitle,
} from '@/features/destinos'
import { StatePage } from '@/features/destinos/components/state-page'
import { ufName } from '@/lib/estados'
import { cityGuide, guideCredits } from '@/features/destinos/guias'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  if (isStateSlug(slug)) {
    const st = await getStateDestination(slug)
    if (!st) return { title: 'Destino não encontrado', robots: { index: false } }
    const title = stateTitle(st)
    const description = stateDescription(st)
    return {
      title,
      description,
      alternates: { canonical: `/destinos/${st.slug}` },
      openGraph: { type: 'website', url: absoluteUrl(`/destinos/${st.slug}`), title, description },
      // Com uma cidade só, a página do estado repetiria a da cidade.
      ...(stateIndexable(st) ? {} : { robots: { index: false, follow: true } }),
    }
  }
  const d = await getCityDestination(slug)
  if (!d) return { title: 'Destino não encontrado', robots: { index: false } }
  const photo = cityPhoto(d, await getDestinations()) ?? cityGuide(d.slug)?.hero.src ?? d.image
  const title = destinationTitle(d)
  const description = destinationDescription(d)
  const path = `/destinos/${d.slug}`
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      url: absoluteUrl(path),
      title,
      description,
      ...(photo ? { images: [{ url: photo, alt: title }] } : {}),
    },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function DestinoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (isStateSlug(slug)) return <EstadoPage slug={slug} />
  const d = await getCityDestination(slug)
  // Sem pousada publicada na cidade, não há página: nada de página vazia no Google.
  if (!d) notFound()

  const faq = destinationFaq(d)
  const [all, curated] = await Promise.all([getCityDestinations(), getDestinations()])
  const others = all.filter((o) => o.slug !== d.slug).slice(0, 8)
  const guide = cityGuide(d.slug)
  // Foto do /admin → Destinos tem prioridade; depois a capa do guia da cidade.
  const photo = cityPhoto(d, curated) ?? guide?.hero.src ?? null
  const photoAlt = guide?.hero.alt ?? `${d.city}, ${d.state}`
  const state = await getStateDestination(d.state.toLowerCase())
  const stateHref = state && stateIndexable(state) ? `/destinos/${state.slug}` : undefined
  const count = d.pousadas.length

  return (
    <div className="bg-background min-h-screen">
      <JsonLd data={destinationJsonLd(d, faq, stateHref)} />
      <SiteHeader forceSolid />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-7xl px-5 pt-32 pb-20 lg:px-8">
        <Breadcrumb
          items={[
            { label: 'Início', href: '/' },
            { label: 'Destinos', href: '/destinos' },
            ...(ufName(d.state)
              ? [{ label: ufName(d.state)!, href: `/destinos/${d.state.toLowerCase()}` }]
              : []),
            { label: `${d.city}, ${d.state}` },
          ]}
        />

        {photo ? (
          // Capa com a foto da cidade (cadastrada em /admin → Destinos).
          <header className="relative mt-6 overflow-hidden rounded-3xl">
            <div className="relative aspect-[4/5] sm:aspect-[16/9] lg:aspect-[2/1]">
              <Image
                src={photo}
                alt={photoAlt}
                fill
                priority
                sizes="(max-width: 1280px) 100vw, 1280px"
                className="object-cover object-[center_55%]"
              />
              <div className="from-breu/85 via-breu/30 absolute inset-0 bg-gradient-to-t to-transparent" />
              <div className="text-primary-foreground absolute inset-x-0 bottom-0 p-6 sm:p-10">
                <h1 className="text-display-l text-balance">{destinationTitle(d)}</h1>
                {guide && (
                  <p className="text-primary-foreground/90 mt-3 max-w-2xl text-lg text-pretty">
                    {guide.tagline}
                  </p>
                )}
              </div>
            </div>
          </header>
        ) : (
          <h1 className="text-display-l text-foreground mt-6 max-w-3xl text-balance">
            {destinationTitle(d)}
          </h1>
        )}

        <div className="mt-6 max-w-3xl">
          <p className="text-muted-foreground text-lg leading-relaxed text-pretty">
            {destinationIntro(d)}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Badge variant="outline" size="lg" className="bg-card border-transparent">
              {count === 1 ? '1 pousada' : `${count} pousadas`}
            </Badge>
            {d.priceFrom > 0 && (
              <Badge variant="outline" size="lg" className="bg-card border-transparent">
                A partir de {formatPrice(d.priceFrom)}
              </Badge>
            )}
            {d.rating !== null && (
              <Badge
                variant="outline"
                size="lg"
                className="bg-card border-transparent tabular-nums"
              >
                <Star className="fill-ipe text-ipe size-3.5" aria-hidden />
                {d.rating.toFixed(1)} ·{' '}
                {d.reviews === 1 ? '1 avaliação' : `${d.reviews} avaliações`}
              </Badge>
            )}
          </div>
        </div>

        {guide && (
          <section aria-labelledby="passeios" className="mt-14">
            <h2 id="passeios" className="text-h2 text-foreground">
              O que fazer em {d.city}
            </h2>
            <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {guide.highlights.map((h) => (
                <li key={h.title}>
                  <article className="group bg-card h-full overflow-hidden rounded-3xl">
                    <div className="relative aspect-[4/5] overflow-hidden">
                      <Image
                        src={h.photo.src}
                        alt={h.photo.alt}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                        className="object-cover transition-transform duration-(--motion-reveal) group-hover:scale-105"
                      />
                    </div>
                    <div className="p-5">
                      <h3 className="text-h3 text-foreground">{h.title}</h3>
                      <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{h.text}</p>
                    </div>
                  </article>
                </li>
              ))}
            </ul>
            {guide.alsoWorth.length > 0 && (
              <p className="text-muted-foreground mt-5 text-base">
                <span className="text-foreground font-semibold">Também vale: </span>
                {guide.alsoWorth.join(' · ')}
              </p>
            )}
            <p className="text-muted-foreground/70 mt-3 text-xs">
              Fotos: {guideCredits(guide).join(', ')} (Unsplash).
            </p>
          </section>
        )}

        <section aria-labelledby="lista-pousadas" className="mt-14">
          <h2 id="lista-pousadas" className="text-h2 text-foreground">
            {count === 1 ? `A pousada em ${d.city}` : `As pousadas em ${d.city}`}
          </h2>
          <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {d.pousadas.map((pousada) => (
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

        <section aria-labelledby="perguntas" className="mt-16 max-w-3xl">
          <h2 id="perguntas" className="text-h2 text-foreground">
            Perguntas sobre pousadas em {d.city}
          </h2>
          <div className="divide-border border-border mt-6 divide-y border-y">
            {faq.map((item) => (
              <details key={item.question} className="group py-4">
                <summary className="text-foreground cursor-pointer list-none text-base font-semibold marker:hidden">
                  {item.question}
                </summary>
                <p className="text-muted-foreground mt-2 text-base leading-relaxed">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </section>

        {others.length > 0 && (
          <section aria-labelledby="outros-destinos" className="mt-16">
            <h2 id="outros-destinos" className="text-h3 text-foreground">
              Outros destinos
            </h2>
            <ul className="mt-4 flex flex-wrap gap-2">
              {others.map((o) => (
                <li key={o.slug}>
                  <Link
                    href={`/destinos/${o.slug}`}
                    className={buttonVariants({ variant: 'outline', size: 'pill-sm' })}
                  >
                    Pousadas em {o.city}, {o.state}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="mt-12">
          <Link href="/pousadas" className={cn(buttonVariants({ size: 'pill' }), 'w-fit')}>
            Ver todas as pousadas
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}

async function EstadoPage({ slug }: { slug: string }) {
  const [state, curated] = await Promise.all([getStateDestination(slug), getDestinations()])
  if (!state) notFound()
  const photoOf = (citySlug: string) => {
    const city = state.cities.find((c) => c.slug === citySlug)
    if (!city) return ''
    return cityPhoto(city, curated) ?? cityGuide(city.slug)?.hero.src ?? city.image
  }
  return (
    <div className="bg-background min-h-screen">
      <SiteHeader forceSolid />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-7xl px-5 pt-32 pb-20 lg:px-8">
        <StatePage state={state} cityPhoto={photoOf} />
      </main>
      <SiteFooter />
    </div>
  )
}
