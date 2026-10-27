import type { Metadata } from 'next'
import { catalogQuerySchema } from '@/features/pousadas/search'
import { notFound } from 'next/navigation'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { PousadaDetail } from '@/components/pousada/pousada-detail'
import { PousadaCard } from '@/components/pousada/pousada-card'
import { Reveal } from '@/components/reveal'
import { Section } from '@/components/ui/container'
import { SectionHeading } from '@/components/ui/section-heading'
import { JsonLd } from '@/components/seo/json-ld'
import {
  getCurrentUser,
  getPousada,
  getPousadaSlugs,
  getNearbyPousadas,
  getPublicReviews,
  isFavoritePousada,
  getBookableRoom,
  getPublicRooms,
  getPublicFeaturedCoupon,
} from '@/server/queries'
import { pousadaMetadata, pousadaJsonLd } from '@/lib/seo'
import { bioOriginFromParam, nightsBetween } from '@/features/reservas'

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
  searchParams: Promise<{ checkin?: string; checkout?: string; guests?: string; origem?: string }>
}) {
  const { slug } = await params
  const initialBooking = await searchParams
  const filters = catalogQuerySchema.safeParse({
    checkin: initialBooking.checkin,
    checkout: initialBooking.checkout,
    guests: initialBooking.guests,
  })
  const [pousada, currentUser, favorite, room, rooms] = await Promise.all([
    getPousada(slug),
    getCurrentUser(),
    isFavoritePousada(slug),
    filters.success
      ? getBookableRoom(slug, filters.data.checkin, filters.data.checkout, filters.data.guests)
      : Promise.resolve(null),
    filters.success
      ? getPublicRooms(slug, filters.data.checkin, filters.data.checkout, filters.data.guests)
      : getPublicRooms(slug),
  ])
  const stayNights =
    filters.success && filters.data.checkin && filters.data.checkout
      ? nightsBetween(filters.data.checkin, filters.data.checkout)
      : 0
  if (!pousada) notFound()

  const [nearby, reviews, featuredCoupon] = await Promise.all([
    getNearbyPousadas(slug, 3),
    getPublicReviews(pousada.id),
    // Cupom divulgado (0100): sem cupom valendo hoje, nada aparece.
    getPublicFeaturedCoupon(slug),
  ])

  return (
    <div className="bg-background min-h-screen">
      <JsonLd data={pousadaJsonLd(pousada)} />
      <SiteHeader forceSolid />
      <main id="conteudo" tabIndex={-1}>
        <PousadaDetail
          pousada={pousada}
          room={room}
          rooms={rooms}
          stayNights={stayNights}
          reviews={reviews}
          initialBooking={{
            checkin: initialBooking.checkin,
            checkout: initialBooking.checkout,
            guests: initialBooking.guests,
          }}
          favorite={favorite}
          isLoggedIn={Boolean(currentUser)}
          bookingOrigin={bioOriginFromParam(initialBooking.origem)}
          featuredCoupon={featuredCoupon}
        />

        {/* Outras pousadas, nos mesmos cards comparáveis da home. */}
        <Section className="pt-8 pb-24 lg:pb-28">
          <Reveal>
            <SectionHeading
              title="Experiências próximas"
              description="Outros refúgios para continuar a sua rota."
            />
          </Reveal>
          <Reveal>
            <ul className="-mx-5 mt-8 flex snap-x snap-mandatory scroll-px-5 [scrollbar-width:none] gap-4 overflow-x-auto px-5 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-6 sm:overflow-visible sm:px-0 lg:grid-cols-3">
              {nearby.map((p) => (
                <li key={p.slug} className="w-[82%] shrink-0 snap-start sm:w-auto">
                  <PousadaCard
                    pousada={p}
                    sizes="(max-width: 640px) 82vw, (max-width: 1024px) 50vw, 33vw"
                  />
                </li>
              ))}
            </ul>
          </Reveal>
        </Section>
      </main>
      <SiteFooter withBottomBar />
    </div>
  )
}
