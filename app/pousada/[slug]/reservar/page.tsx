import type { Metadata } from 'next'
import { catalogQuerySchema } from '@/features/pousadas/search'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { MapPin, Star } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { Container } from '@/components/ui/container'
import { Card } from '@/components/ui/card'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { BookingForm, bioOriginFromParam } from '@/features/reservas'
import { getPousada, getCurrentUser, getBookableRoom } from '@/server/queries'

export const metadata: Metadata = {
  title: 'Reservar',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function ReservarPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ checkin?: string; checkout?: string; guests?: string; origem?: string }>
}) {
  const { slug } = await params
  const initial = await searchParams
  const origin = bioOriginFromParam(initial.origem)
  const filters = catalogQuerySchema.safeParse({
    checkin: initial.checkin,
    checkout: initial.checkout,
    guests: initial.guests,
  })
  const [pousada, user, bookable] = await Promise.all([
    getPousada(slug),
    getCurrentUser(),
    filters.success
      ? getBookableRoom(slug, filters.data.checkin, filters.data.checkout, filters.data.guests)
      : Promise.resolve(null),
  ])

  if (!pousada || !bookable) notFound()
  if (!user) {
    const bookingParams = new URLSearchParams()
    if (initial.checkin) bookingParams.set('checkin', initial.checkin)
    if (initial.checkout) bookingParams.set('checkout', initial.checkout)
    if (initial.guests) bookingParams.set('guests', initial.guests)
    if (origin) bookingParams.set('origem', origin)

    const nextPath = `/pousada/${slug}/reservar${
      bookingParams.size > 0 ? `?${bookingParams.toString()}` : ''
    }`
    redirect(`/login?next=${encodeURIComponent(nextPath)}`)
  }

  return (
    <div className="bg-background min-h-screen">
      <SiteHeader forceSolid />
      <main className="pt-28 pb-24">
        <Container className="max-w-3xl">
          <Breadcrumb
            items={[
              { label: 'Pousadas', href: '/#pousadas' },
              { label: pousada.name, href: `/pousada/${slug}` },
              { label: 'Reservar' },
            ]}
          />

          <div className="mt-6 grid gap-8 md:grid-cols-[1fr_1.1fr]">
            <Card radius="3xl" className="overflow-hidden p-0">
              <div className="relative aspect-[4/3]">
                <Image
                  src={pousada.image || '/placeholder.svg'}
                  alt={pousada.name}
                  fill
                  sizes="40vw"
                  className="object-cover"
                />
              </div>
              <div className="p-5">
                <h1 className="text-foreground font-serif text-xl font-semibold">{pousada.name}</h1>
                <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-3 text-sm">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="size-4" />
                    {pousada.city}, {pousada.state}
                  </span>
                  <span className="text-foreground inline-flex items-center gap-1 font-semibold">
                    <Star className="fill-gold text-gold size-4" />
                    {pousada.rating.toFixed(1)}
                  </span>
                </div>
                <p className="mt-3 text-sm">
                  <span className="text-foreground text-lg font-semibold">
                    R$ {bookable.nightly}
                  </span>
                  <span className="text-muted-foreground"> / diária</span>
                </p>
              </div>
            </Card>

            <Card radius="3xl" className="shadow-card p-6">
              <h2 className="text-foreground font-serif text-lg font-semibold">Sua reserva</h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Escolha as datas e a quantidade de hóspedes.
              </p>
              <div className="mt-5">
                <BookingForm
                  pousadaSlug={slug}
                  nightly={bookable.nightly}
                  capacity={bookable.capacity}
                  initialCheckin={initial.checkin}
                  initialCheckout={initial.checkout}
                  initialGuests={initial.guests}
                  origin={origin}
                />
              </div>
            </Card>
          </div>

          <p className="text-muted-foreground mt-6 text-center text-sm">
            <Link href={`/pousada/${slug}`} className="text-primary font-semibold hover:underline">
              ← Voltar para a pousada
            </Link>
          </p>
        </Container>
      </main>
    </div>
  )
}
