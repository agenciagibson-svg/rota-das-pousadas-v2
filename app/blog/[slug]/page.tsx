import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronDown, Clock } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { JsonLd } from '@/components/seo/json-ld'
import { absoluteUrl, siteConfig } from '@/lib/seo'
import { getBlogTips, getCityDestinations, getHolidayStays } from '@/server/queries'
import type { MapResult } from '@/components/map/result-card'
import { GuideMap } from '@/features/blog/components/guide-map'
import { ReaderTips } from '@/features/blog/components/reader-tips'
import { WhereToStay } from '@/features/blog/components/where-to-stay'
import { PostBody } from '@/features/blog/components/post-body'
import { findPost, formatPostDate, readingMinutes, visiblePosts } from '@/features/blog/posts'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const post = findPost(slug)
  if (!post) return { title: 'Texto não encontrado', robots: { index: false } }
  const path = `/blog/${post.slug}`
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: path },
    openGraph: {
      type: 'article',
      url: absoluteUrl(path),
      title: post.title,
      description: post.description,
      publishedTime: post.publishedAt,
    },
    twitter: { card: 'summary_large_image', title: post.title, description: post.description },
    // Rascunho (só existe na versão de teste) nunca vai para o Google.
    ...(post.status === 'rascunho' ? { robots: { index: false, follow: false } } : {}),
  }
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = findPost(slug)
  if (!post) notFound()

  const cities = await getCityDestinations()
  const stays = post.cities
    .flatMap((c) => cities.find((d) => d.slug === c.slug)?.pousadas ?? [])
    .slice(0, 6)
  const others = visiblePosts()
    .filter((p) => p.slug !== post.slug)
    .slice(0, 3)
  const mainCity = post.cities[0]
  const [holiday, tips] = await Promise.all([
    mainCity ? getHolidayStays(mainCity.name) : null,
    getBlogTips(post.slug),
  ])
  // No mapa só entra pousada com ponto marcado pelo dono (0095).
  const mapStays: MapResult[] = stays.flatMap((p) =>
    p.coordinates
      ? [
          {
            slug: p.slug,
            name: p.name,
            city: p.city,
            state: p.state,
            image: p.image,
            price: p.pricePerNight,
            href: `/pousada/${p.slug}`,
            point: p.coordinates,
          },
        ]
      : [],
  )
  const places = post.places ?? []
  const photos = [post.cover, ...post.blocks.flatMap((b) => (b.type === 'image' ? [b.photo] : []))]
  const credits = [...new Map(photos.map((p) => [p.sourceUrl, p])).values()]
  const path = `/blog/${post.slug}`

  return (
    <div className="bg-background min-h-screen">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'BlogPosting',
              headline: post.title,
              description: post.description,
              image: [post.cover.src],
              datePublished: post.publishedAt,
              dateModified: post.updatedAt ?? post.publishedAt,
              mainEntityOfPage: absoluteUrl(path),
              author: { '@type': 'Organization', name: siteConfig.name, url: siteConfig.url },
              publisher: { '@type': 'Organization', name: siteConfig.name, url: siteConfig.url },
            },
            {
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Início', item: absoluteUrl('/') },
                { '@type': 'ListItem', position: 2, name: 'Blog', item: absoluteUrl('/blog') },
                { '@type': 'ListItem', position: 3, name: post.title, item: absoluteUrl(path) },
              ],
            },
            ...(post.faq?.length
              ? [
                  {
                    '@type': 'FAQPage',
                    mainEntity: post.faq.map((f) => ({
                      '@type': 'Question',
                      name: f.question,
                      acceptedAnswer: { '@type': 'Answer', text: f.answer },
                    })),
                  },
                ]
              : []),
          ],
        }}
      />
      <SiteHeader forceSolid />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-7xl px-5 pt-32 pb-20 lg:px-8">
        {post.status === 'rascunho' && (
          <p className="bg-ipe/20 text-foreground mb-6 rounded-xl px-4 py-3 text-sm font-medium">
            Rascunho para aprovação: este texto só aparece na versão de teste.
          </p>
        )}
        <Breadcrumb
          items={[
            { label: 'Início', href: '/' },
            { label: 'Blog', href: '/blog' },
            { label: post.place },
          ]}
        />

        <article className="mt-6">
          <header className="mx-auto max-w-3xl">
            <p className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
              {post.place}
            </p>
            <h1 className="text-display-l text-foreground mt-2 text-balance">{post.title}</h1>
            <p className="text-muted-foreground mt-4 text-xl leading-relaxed text-pretty">
              {post.description}
            </p>
            <p className="text-muted-foreground mt-4 flex items-center gap-2 text-sm">
              <span>{formatPostDate(post.publishedAt)}</span>
              <span aria-hidden>·</span>
              <Clock className="size-4" aria-hidden />
              <span>{readingMinutes(post)} min de leitura</span>
            </p>
          </header>

          <figure className="mt-8">
            <div className="relative aspect-[4/3] overflow-hidden rounded-3xl sm:aspect-[21/9]">
              <Image
                src={post.cover.src}
                alt={post.cover.alt}
                fill
                priority
                sizes="(max-width: 1280px) 100vw, 1280px"
                className="object-cover"
              />
            </div>
            <figcaption className="text-muted-foreground/70 mt-2 text-xs">
              Foto: {post.cover.credit} ({post.cover.license})
            </figcaption>
          </figure>

          <div className="mx-auto mt-10 max-w-3xl">
            <PostBody blocks={post.blocks} />

            {(places.length > 0 || mapStays.length > 0) && (
              <section aria-labelledby="no-mapa" className="mt-14">
                <h2 id="no-mapa" className="text-h2 text-foreground mb-6">
                  No mapa
                </h2>
                <GuideMap places={places} stays={mapStays} />
              </section>
            )}

            {mainCity && <WhereToStay city={mainCity} stays={stays} holiday={holiday} />}

            <ReaderTips postSlug={post.slug} place={post.place} tips={tips} />

            {post.faq && post.faq.length > 0 && (
              <section aria-labelledby="perguntas" className="mt-14">
                <h2 id="perguntas" className="text-h2 text-foreground">
                  Perguntas frequentes
                </h2>
                <div className="divide-border border-border mt-6 divide-y border-y">
                  {post.faq.map((item) => (
                    <details key={item.question} className="group py-4">
                      <summary className="text-foreground flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold [&::-webkit-details-marker]:hidden">
                        {item.question}
                        <ChevronDown
                          className="text-muted-foreground size-5 shrink-0 transition-transform group-open:rotate-180"
                          aria-hidden
                        />
                      </summary>
                      <p className="text-muted-foreground mt-2 text-base leading-relaxed">
                        {item.answer}
                      </p>
                    </details>
                  ))}
                </div>
              </section>
            )}

            <p className="text-muted-foreground/70 mt-12 text-xs leading-relaxed">
              Fotos:{' '}
              {credits.map((c, i) => (
                <span key={c.sourceUrl}>
                  {i > 0 && ' · '}
                  <a href={c.sourceUrl} className="underline" rel="noopener" target="_blank">
                    {c.credit}
                  </a>{' '}
                  ({c.license})
                </span>
              ))}
              . Informações conferidas em {formatPostDate(post.updatedAt ?? post.publishedAt)};
              confirme horários e acessos antes de ir.
            </p>
          </div>
        </article>

        {others.length > 0 && (
          <section aria-labelledby="mais-textos" className="mx-auto mt-16 max-w-3xl">
            <h2 id="mais-textos" className="text-h3 text-foreground">
              Mais guias
            </h2>
            <ul className="mt-4 space-y-2">
              {others.map((o) => (
                <li key={o.slug}>
                  <Link href={`/blog/${o.slug}`} className="text-foreground underline">
                    {o.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
      <SiteFooter />
    </div>
  )
}
