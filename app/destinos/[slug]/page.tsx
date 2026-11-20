import type { Metadata } from 'next'
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
import { getCityDestination, getCityDestinations } from '@/server/queries'
import {
  destinationDescription,
  destinationFaq,
  destinationIntro,
  destinationJsonLd,
  destinationTitle,
} from '@/features/destinos'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const d = await getCityDestination(slug)
  if (!d) return { title: 'Destino não encontrado', robots: { index: false } }
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
      ...(d.image ? { images: [{ url: d.image, alt: title }] } : {}),
    },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function DestinoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const d = await getCityDestination(slug)
  // Sem pousada publicada na cidade, não há página: nada de página vazia no Google.
  if (!d) notFound()

  const faq = destinationFaq(d)
  const others = (await getCityDestinations()).filter((o) => o.slug !== d.slug).slice(0, 8)
  const count = d.pousadas.length

  return (
    <div className="bg-background min-h-screen">
      <JsonLd data={destinationJsonLd(d, faq)} />
      <SiteHeader forceSolid />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-7xl px-5 pt-32 pb-20 lg:px-8">
        <Breadcrumb
          items={[
            { label: 'Início', href: '/' },
            { label: 'Destinos', href: '/destinos' },
            { label: `${d.city}, ${d.state}` },
          ]}
        />

        <header className="mt-6 max-w-3xl">
          <h1 className="text-display-l text-foreground text-balance">{destinationTitle(d)}</h1>
          <p className="text-muted-foreground mt-4 text-lg leading-relaxed text-pretty">
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
        </header>

        <section aria-labelledby="lista-pousadas" className="mt-12">
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
