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
import { BookingForm } from '@/features/reservas'
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
  searchParams: Promise<{ checkin?: string; checkout?: string; guests?: string }>
}) {
  const { slug } = await params
  const initial = await searchParams
  const filters = catalogQuerySchema.safeParse({ checkin: initial.checkin, checkout: initial.checkout, guests: initial.guests })
  const [pousada, user, bookable] = await Promise.all([
    getPousada(slug),
    getCurrentUser(),
    filters.success ? getBookableRoom(slug, filters.data.checkin, filters.data.checkout, filters.data.guests) : Promise.resolve(null),
  ])

  if (!pousada || !bookable) notFound()
  if (!user) {
    const bookingParams = new URLSearchParams()
    if (initial.checkin) bookingParams.set('checkin', initial.checkin)
    if (initial.checkout) bookingParams.set('checkout', initial.checkout)
    if (initial.guests) bookingParams.set('guests', initial.guests)

    const nextPath = `/pousada/${slug}/reservar${
      bookingParams.size > 0 ? `?${bookingParams.toString()}` : ''
    }`
    redirect(`/login?next=${encodeURIComponent(nextPath)}`)
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader forceSolid />
      <main className="pb-24 pt-28">
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
                <Image src={pousada.image || '/placeholder.svg'} alt={pousada.name} fill sizes="40vw" className="object-cover" />
              </div>
              <div className="p-5">
                <h1 className="font-serif text-xl font-semibold text-foreground">{pousada.name}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="size-4" />
                    {pousada.city}, {pousada.state}
                  </span>
                  <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                    <Star className="size-4 fill-gold text-gold" />
                    {pousada.rating.toFixed(1)}
                  </span>
                </div>
                <p className="mt-3 text-sm">
                  <span className="text-lg font-semibold text-foreground">R$ {bookable.nightly}</span>
                  <span className="text-muted-foreground"> / diária</span>
                </p>
              </div>
            </Card>

            <Card radius="3xl" className="p-6 shadow-card">
              <h2 className="font-serif text-lg font-semibold text-foreground">Sua reserva</h2>
              <p className="mt-1 text-sm text-muted-foreground">
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
                />
              </div>
            </Card>
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            <Link href={`/pousada/${slug}`} className="font-semibold text-primary hover:underline">
              ← Voltar para a pousada
            </Link>
          </p>
        </Container>
      </main>
    </div>
  )
}
