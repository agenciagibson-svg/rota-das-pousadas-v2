import type { Metadata } from 'next'
import { catalogQuerySchema } from '@/features/pousadas/search'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
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
import { getCityCenter } from '@/lib/geo/city-center'
import { TrackEvent } from '@/components/analytics/track-event'
import { destinationPath } from '@/features/destinos'
import { pousadaFaq, pousadaFaqJsonLd } from '@/features/pousadas/faq'

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

  const [nearby, reviews, featuredCoupon, areaCenter] = await Promise.all([
    getNearbyPousadas(slug, 3),
    getPublicReviews(pousada.id),
    // Cupom divulgado (0100): sem cupom valendo hoje, nada aparece.
    getPublicFeaturedCoupon(slug),
    // Sem ponto marcado: mapa da região da cidade (cache de 30 dias por cidade).
    pousada.coordinates ? Promise.resolve(null) : getCityCenter(pousada.city, pousada.state),
  ])

  const faq = pousadaFaq(pousada)

  return (
    <div className="bg-background min-h-screen">
      <JsonLd data={pousadaJsonLd(pousada)} />
      <JsonLd data={pousadaFaqJsonLd(faq)} />
      <TrackEvent
        name="view_item"
        params={{ pousada_id: pousada.id, pousada_nome: pousada.name, cidade: pousada.city }}
      />
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
          areaCenter={areaCenter}
          bookingOrigin={bioOriginFromParam(initialBooking.origem)}
          featuredCoupon={featuredCoupon}
        />

        {/* Perguntas frequentes: só o que a pousada cadastrou (features/pousadas/faq.ts). */}
        <Section className="pt-4 pb-8">
          <div className="max-w-3xl">
            <h2 className="text-h2 text-foreground">Perguntas frequentes</h2>
            <div className="divide-border border-border mt-6 divide-y border-y">
              {faq.map((item) => (
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
          </div>
        </Section>

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
          {/* Link interno para a página da cidade (SEO e navegação). */}
          <Link
            href={destinationPath(pousada.city, pousada.state)}
            className="text-foreground hover:text-primary mt-6 inline-flex text-sm font-semibold underline underline-offset-4"
          >
            Ver pousadas em {pousada.city}, {pousada.state}
          </Link>
        </Section>
      </main>
      <SiteFooter withBottomBar />
    </div>
  )
}
