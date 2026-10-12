import type { Metadata } from 'next'
import { catalogQuerySchema } from '@/features/pousadas/search'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { CalendarX2, IdCard, MapPin, Star } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { Container } from '@/components/ui/container'
import { Card } from '@/components/ui/card'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { BookingForm, StaleDatesNotice, bioOriginFromParam } from '@/features/reservas'
import { getPousada, getCurrentUser, getBookableRoom, getMyProfile } from '@/server/queries'
import { buttonVariants } from '@/components/ui/button'
import { formatPrice } from '@/lib/format'

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

  if (!pousada) notFound()

  // Nenhum parâmetro ruim pode virar "Pousada não encontrada": datas ocupadas,
  // invertidas, inválidas ou hóspedes acima da capacidade mostram a página com
  // um aviso claro e o formulário limpo. A oferta de referência (preço e
  // capacidade) é buscada sem filtros quando a combinação pedida não tem vaga.
  const askedSomething = Boolean(initial.checkin || initial.checkout || initial.guests)
  const offer = bookable ?? (await getBookableRoom(slug, undefined, undefined, undefined))
  const askedGuests = filters.success ? filters.data.guests : undefined
  const problem: null | 'invalid' | 'capacity' | 'unavailable' = bookable
    ? null
    : !filters.success
      ? 'invalid'
      : offer && askedGuests && askedGuests > offer.capacity
        ? 'capacity'
        : askedSomething && filters.data.checkin && filters.data.checkout
          ? 'unavailable'
          : null
  const problemMessage = {
    invalid: {
      title: 'Não entendemos as datas escolhidas.',
      body: 'Confira se a saída é depois da entrada e escolha o período abaixo.',
    },
    capacity: {
      title: `A acomodação recebe até ${offer?.capacity ?? ''} hóspedes.`,
      body: 'Ajuste a quantidade de hóspedes ou fale com a pousada para grupos maiores.',
    },
    unavailable: {
      title: 'Essas datas não estão mais disponíveis.',
      body: 'Escolha outro período abaixo para ver a disponibilidade.',
    },
  }
  const clearDates = problem === 'invalid' || problem === 'unavailable'
  const clearGuests = problem === 'invalid' || problem === 'capacity'

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

  // A pousada recebe o cadastro do hóspede (FNRH) — sem ele, não dá para reservar.
  const me = await getMyProfile()
  const missingProfile = me?.missing ?? []
  const returnParams = new URLSearchParams()
  for (const key of ['checkin', 'checkout', 'guests', 'origem'] as const) {
    const value = initial[key]
    if (value) returnParams.set(key, value)
  }
  const completeProfileHref = `/conta?next=${encodeURIComponent(
    `/pousada/${slug}/reservar${returnParams.size > 0 ? `?${returnParams.toString()}` : ''}`,
  )}`

  return (
    <div className="bg-background min-h-screen">
      <SiteHeader forceSolid />
      <main className="pt-28 pb-24">
        <Container className="max-w-5xl">
          <Breadcrumb
            items={[
              { label: 'Pousadas', href: '/#pousadas' },
              { label: pousada.name, href: `/pousada/${slug}` },
              { label: 'Reservar' },
            ]}
          />

          <div className="mt-6 grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-10">
            {/* A pousada escolhida, para o hóspede saber o que está reservando. */}
            <Card radius="3xl" border={false} className="overflow-hidden md:sticky md:top-28">
              <div className="relative aspect-[4/3]">
                <Image
                  src={pousada.image || '/placeholder.svg'}
                  alt={pousada.name}
                  fill
                  sizes="(max-width: 768px) 100vw, 40vw"
                  className="object-cover"
                />
              </div>
              <div className="p-5 lg:p-6">
                <h1 className="text-h2 text-foreground">{pousada.name}</h1>
                <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-3 text-base">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="size-4" />
                    {pousada.city}, {pousada.state}
                  </span>
                  <span className="text-foreground inline-flex items-center gap-1 font-semibold tabular-nums">
                    <Star className="fill-ipe text-ipe size-4" />
                    {pousada.rating.toFixed(1)}
                  </span>
                </div>
                <p className="mt-3 text-base">
                  <span className="text-foreground text-xl font-semibold tabular-nums">
                    {formatPrice(offer?.nightly ?? pousada.pricePerNight)}
                  </span>
                  <span className="text-muted-foreground"> / diária</span>
                </p>
              </div>
            </Card>

            <Card radius="3xl" border={false} className="shadow-floating p-6 lg:p-8">
              <h2 className="text-h2 text-foreground">Sua reserva</h2>
              <p className="text-muted-foreground mt-1 text-base">
                Escolha as datas e a quantidade de hóspedes.
              </p>
              {problem && (
                <StaleDatesNotice>
                  <div
                    role="alert"
                    className="border-ipe/50 bg-ipe/15 text-foreground mt-4 flex gap-3 rounded-2xl border p-4 text-sm"
                  >
                    <CalendarX2 className="mt-0.5 size-5 shrink-0" />
                    <p>
                      <strong>{problemMessage[problem].title}</strong>{' '}
                      {problemMessage[problem].body}
                    </p>
                  </div>
                </StaleDatesNotice>
              )}
              {offer && missingProfile.length > 0 ? (
                <div className="bg-secondary mt-5 rounded-2xl p-5 text-sm">
                  <div className="flex items-start gap-3">
                    <IdCard className="text-foreground mt-0.5 size-5 shrink-0" />
                    <div>
                      <p className="text-foreground text-base font-semibold">
                        Complete seu cadastro para reservar
                      </p>
                      <p className="text-muted-foreground mt-1">
                        A pousada precisa destes dados para a ficha de hospedagem (FNRH). Falta:{' '}
                        {missingProfile.join(', ')}. Leva 1 minuto e você volta direto para cá.
                      </p>
                    </div>
                  </div>
                  <Link
                    href={completeProfileHref}
                    className={buttonVariants({ size: 'pill', className: 'mt-4 w-full' })}
                  >
                    Completar cadastro
                  </Link>
                </div>
              ) : offer ? (
                <div className="mt-5">
                  <BookingForm
                    pousadaSlug={slug}
                    nightly={offer.nightly}
                    capacity={offer.capacity}
                    initialCheckin={clearDates ? '' : initial.checkin}
                    initialCheckout={clearDates ? '' : initial.checkout}
                    initialGuests={clearGuests ? undefined : initial.guests}
                    origin={origin}
                  />
                </div>
              ) : (
                <div className="bg-secondary mt-5 rounded-2xl p-5 text-sm">
                  <p className="text-base font-semibold">Reserva online indisponível no momento.</p>
                  <p className="text-muted-foreground mt-1">
                    Esta pousada ainda não tem acomodações abertas para reserva pelo site. Fale
                    direto com ela pela página da pousada.
                  </p>
                </div>
              )}
            </Card>
          </div>

          <p className="text-muted-foreground mt-8 text-center text-sm">
            <Link
              href={`/pousada/${slug}`}
              className="text-foreground font-semibold underline-offset-4 hover:underline"
            >
              ← Voltar para a pousada
            </Link>
          </p>
        </Container>
      </main>
    </div>
  )
}
