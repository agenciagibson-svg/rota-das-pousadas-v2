import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { SectionHeading } from '@/components/ui/section-heading'
import { Card } from '@/components/ui/card'
import { formatPostDate, readingMinutes, visiblePosts } from '@/features/blog/posts'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const published = visiblePosts(false)
  return {
    title: 'Blog: guias de viagem para quem ama pousadas',
    description:
      'Roteiros, o que fazer e onde ficar nos destinos das pousadas da Rota: cachoeiras, serras, cidades históricas e boa comida.',
    alternates: { canonical: '/blog' },
    // Sem texto publicado, a lista não vai para o Google.
    ...(published.length === 0 ? { robots: { index: false, follow: true } } : {}),
  }
}

export default function BlogPage() {
  const posts = visiblePosts()
  const [first, ...rest] = posts

  return (
    <div className="bg-background min-h-screen">
      <SiteHeader forceSolid />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-7xl px-5 pt-32 pb-20 lg:px-8">
        <SectionHeading
          as="h1"
          eyebrow="Blog"
          title="Guias de viagem"
          description="O que fazer, quando ir e onde ficar nos destinos das pousadas da Rota."
        />

        {!first ? (
          <Card radius="3xl" border={false} className="mt-10 p-10 text-center">
            <h2 className="text-h2 text-foreground">Os primeiros guias estão chegando</h2>
          </Card>
        ) : (
          <>
            <Link
              href={`/blog/${first.slug}`}
              className="group bg-card mt-10 grid overflow-hidden rounded-3xl lg:grid-cols-2"
            >
              <div className="relative aspect-[16/10] lg:aspect-auto lg:min-h-[420px]">
                <Image
                  src={first.cover.src}
                  alt={first.cover.alt}
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover transition-transform duration-(--motion-reveal) group-hover:scale-105"
                />
              </div>
              <div className="flex flex-col justify-center p-6 lg:p-10">
                {first.status === 'rascunho' && (
                  <span className="bg-ipe/25 text-foreground mb-3 w-fit rounded-full px-3 py-1 text-xs font-semibold">
                    Rascunho
                  </span>
                )}
                <p className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
                  {first.place}
                </p>
                <h2 className="text-h1 text-foreground mt-2 text-balance">{first.title}</h2>
                <p className="text-muted-foreground mt-3 text-base leading-relaxed">
                  {first.description}
                </p>
                <p className="text-muted-foreground mt-4 text-sm">
                  {formatPostDate(first.publishedAt)} · {readingMinutes(first)} min de leitura
                </p>
              </div>
            </Link>

            {rest.length > 0 && (
              <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {rest.map((p) => (
                  <li key={p.slug}>
                    <Link
                      href={`/blog/${p.slug}`}
                      className="group bg-card block h-full overflow-hidden rounded-3xl"
                    >
                      <div className="relative aspect-[16/10]">
                        <Image
                          src={p.cover.src}
                          alt={p.cover.alt}
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          className="object-cover transition-transform duration-(--motion-reveal) group-hover:scale-105"
                        />
                      </div>
                      <div className="p-5">
                        <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                          {p.place}
                          {p.status === 'rascunho' ? ' · Rascunho' : ''}
                        </p>
                        <h2 className="text-h3 text-foreground mt-1">{p.title}</h2>
                        <p className="text-muted-foreground mt-2 text-sm">
                          {readingMinutes(p)} min de leitura
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  )
}
