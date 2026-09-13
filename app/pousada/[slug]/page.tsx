import type { Metadata } from 'next'
import { catalogQuerySchema } from '@/features/pousadas/search'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { PousadaDetail } from '@/components/pousada/pousada-detail'
import { Reveal } from '@/components/reveal'
import { JsonLd } from '@/components/seo/json-ld'
import {
  getCurrentUser,
  getPousada,
  getPousadaSlugs,
  getNearbyPousadas,
  isFavoritePousada,
  getBookableRoom,
} from '@/server/queries'
import { pousadaMetadata, pousadaJsonLd } from '@/lib/seo'
import { MapPin, Star } from 'lucide-react'

export const dynamic = 'force-dynamic'

export async function generateStaticParams() {
  const slugs = await getPousadaSlugs()
  return slugs.map((slug) => ({ slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const pousada = await getPousada(slug)
  if (!pousada) return { title: 'Pousada não encontrada' }
  return pousadaMetadata(pousada)
}

export default async function PousadaPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ checkin?: string; checkout?: string; guests?: string }>
}) {
  const { slug } = await params
  const initialBooking = await searchParams
  const filters = catalogQuerySchema.safeParse({ checkin: initialBooking.checkin, checkout: initialBooking.checkout, guests: initialBooking.guests })
  const [pousada, currentUser, favorite, room] = await Promise.all([
    getPousada(slug),
    getCurrentUser(),
    isFavoritePousada(slug),
    filters.success ? getBookableRoom(slug, filters.data.checkin, filters.data.checkout, filters.data.guests) : Promise.resolve(null),
  ])
  if (!pousada) notFound()

  const nearby = await getNearbyPousadas(slug, 3)

  return (
    <div className="min-h-screen bg-background">
      <JsonLd data={pousadaJsonLd(pousada)} />
      <SiteHeader forceSolid />
      <main>
        <PousadaDetail
          pousada={pousada}
          room={room}
          initialBooking={{
            checkin: initialBooking.checkin,
            checkout: initialBooking.checkout,
            guests: initialBooking.guests,
          }}
          favorite={favorite}
          isLoggedIn={Boolean(currentUser)}
        />

        {/* Nearby experiences */}
        <section className="bg-secondary/50 py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <Reveal>
              <h2 className="font-serif text-3xl font-semibold text-foreground sm:text-4xl">
                Experiências próximas
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Outros refúgios para continuar a sua rota.
              </p>
            </Reveal>
            <div className="mt-10 grid gap-6 sm:grid-cols-3">
              {nearby.map((p, i) => (
                <Reveal key={p.slug} delay={i * 0.08}>
                  <Link
                    href={`/pousada/${p.slug}`}
                    className="group block overflow-hidden rounded-3xl border border-border bg-card transition-all hover:-translate-y-1 hover:shadow-2xl hover:shadow-stone-deep/10"
                  >
                    <div className="relative aspect-[4/3] overflow-hidden">
                      <Image
                        src={p.image || '/placeholder.svg'}
                        alt={p.name}
                        fill
                        sizes="(max-width: 640px) 100vw, 33vw"
                        className="object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    </div>
                    <div className="p-5">
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                          <MapPin className="size-3.5" />
                          {p.city}, {p.state}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-foreground">
                          <Star className="size-3.5 fill-gold text-gold" />
                          {p.rating.toFixed(1)}
                        </span>
                      </div>
                      <h3 className="mt-2 font-serif text-xl font-semibold text-foreground">{p.name}</h3>
                      <div className="mt-3 text-sm">
                        <span className="font-semibold text-foreground">R$ {p.pricePerNight}</span>
                        <span className="text-muted-foreground"> / diária</span>
                      </div>
                    </div>
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
