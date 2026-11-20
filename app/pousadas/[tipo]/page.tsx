import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
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
import { getStayTypePage, getStayTypePages } from '@/server/queries'
import { stayTypeIndexable, type StayTypePage } from '@/features/pousadas/amenities'

export const dynamic = 'force-dynamic'

function description(page: StayTypePage) {
  const n = page.pousadas.length
  const prices = page.pousadas.map((p) => p.pricePerNight).filter((v) => v > 0)
  const from = prices.length ? ` Diárias a partir de ${formatPrice(Math.min(...prices))}.` : ''
  return `${n === 1 ? '1 pousada' : `${n} pousadas`} com reserva direta, sem intermediário.${from} ${page.type.lead}`
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tipo: string }>
}): Promise<Metadata> {
  const { tipo } = await params
  const page = await getStayTypePage(tipo)
  if (!page) return { title: 'Página não encontrada', robots: { index: false } }
  const path = `/pousadas/${page.type.slug}`
  return {
    title: page.type.title,
    description: description(page),
    alternates: { canonical: path },
    openGraph: { type: 'website', url: absoluteUrl(path), title: page.type.title },
    // Com uma pousada só, a página não tem o que oferecer ao Google ainda.
    ...(stayTypeIndexable(page) ? {} : { robots: { index: false, follow: true } }),
  }
}

export default async function TipoPage({ params }: { params: Promise<{ tipo: string }> }) {
  const { tipo } = await params
  const page = await getStayTypePage(tipo)
  if (!page) notFound()
  const others = (await getStayTypePages()).filter(
    (p) => p.type.slug !== page.type.slug && stayTypeIndexable(p),
  )
  const prices = page.pousadas.map((p) => p.pricePerNight).filter((v) => v > 0)
  const priceFrom = prices.length ? Math.min(...prices) : 0
  const path = `/pousadas/${page.type.slug}`

  return (
    <div className="bg-background min-h-screen">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Início', item: absoluteUrl('/') },
                {
                  '@type': 'ListItem',
                  position: 2,
                  name: 'Pousadas',
                  item: absoluteUrl('/pousadas'),
                },
                {
                  '@type': 'ListItem',
                  position: 3,
                  name: page.type.title,
                  item: absoluteUrl(path),
                },
              ],
            },
            {
              '@type': 'ItemList',
              name: page.type.title,
              url: absoluteUrl(path),
              numberOfItems: page.pousadas.length,
              itemListElement: page.pousadas.map((p, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                url: absoluteUrl(`/pousada/${p.slug}`),
                name: p.name,
              })),
            },
          ],
        }}
      />
      <SiteHeader forceSolid />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-7xl px-5 pt-32 pb-20 lg:px-8">
        <Breadcrumb
          items={[
            { label: 'Início', href: '/' },
            { label: 'Pousadas', href: '/pousadas' },
            { label: page.type.title },
          ]}
        />
        <header className="mt-6 max-w-3xl">
          <h1 className="text-display-l text-foreground text-balance">{page.type.title}</h1>
          <p className="text-muted-foreground mt-4 text-lg leading-relaxed text-pretty">
            {page.type.lead} Todas com reserva direta na pousada, sem intermediário, e pagamento por
            Pix ou cartão.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Badge variant="outline" size="lg" className="bg-card border-transparent">
              {page.pousadas.length === 1 ? '1 pousada' : `${page.pousadas.length} pousadas`}
            </Badge>
            {priceFrom > 0 && (
              <Badge variant="outline" size="lg" className="bg-card border-transparent">
                A partir de {formatPrice(priceFrom)}
              </Badge>
            )}
          </div>
        </header>

        {page.cities.length > 1 && (
          <nav aria-label="Por cidade" className="mt-8">
            <p className="text-foreground text-sm font-semibold">Por cidade</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {page.cities.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/destinos/${c.slug}`}
                    className={buttonVariants({ variant: 'outline', size: 'pill-sm' })}
                  >
                    {c.city}, {c.state} ({c.count})
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}

        <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {page.pousadas.map((pousada) => (
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

        {others.length > 0 && (
          <section aria-labelledby="outros-tipos" className="mt-16">
            <h2 id="outros-tipos" className="text-h3 text-foreground">
              Outros tipos de estadia
            </h2>
            <ul className="mt-4 flex flex-wrap gap-2">
              {others.map((o) => (
                <li key={o.type.slug}>
                  <Link
                    href={`/pousadas/${o.type.slug}`}
                    className={buttonVariants({ variant: 'outline', size: 'pill-sm' })}
                  >
                    {o.type.title}
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
