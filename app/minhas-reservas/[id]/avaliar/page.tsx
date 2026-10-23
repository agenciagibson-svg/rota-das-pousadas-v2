import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { CalendarCheck, CalendarClock, CircleCheck, CircleSlash } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { Container } from '@/components/ui/container'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { buttonVariants } from '@/components/ui/button'
import { isSupabaseConfigured } from '@/lib/env'
import { formatISODate } from '@/lib/format'
import { getCurrentUser, getStayReview } from '@/server/queries'
import { StayReviewForm } from '@/features/estadia/components/stay-review-form'
import { parseRatingParam, reviewPagePath } from '@/features/estadia/review'
import { emPousada } from '@/lib/email/templates'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Avaliar estadia',
  robots: { index: false, follow: false },
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function AvaliarEstadiaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ nota?: string | string[] }>
}) {
  const [{ id }, query] = await Promise.all([params, searchParams])
  if (!UUID.test(id)) notFound()
  const rating = parseRatingParam(query.nota)

  // O proxy já exige login em /minhas-reservas; aqui garante a volta com a nota.
  const user = await getCurrentUser()
  if (!user && isSupabaseConfigured()) {
    redirect(`/login?next=${encodeURIComponent(reviewPagePath(id, rating ?? undefined))}`)
  }

  const review = await getStayReview(id)

  return (
    <div className="bg-background min-h-screen">
      <SiteHeader forceSolid />
      <main id="conteudo" tabIndex={-1} className="pt-32 pb-24">
        <Container className="max-w-xl">
          {!review ? (
            <EmptyState
              as="h1"
              icon={CircleSlash}
              title="Esta reserva não é desta conta"
              description="Entre com a conta usada na reserva para avaliar a estadia."
              action={
                <Link href="/minhas-reservas" className={buttonVariants({ size: 'pill' })}>
                  Ver minhas reservas
                </Link>
              }
            />
          ) : (
            <Card radius="3xl" border={false} className="p-6 sm:p-8">
              <p className="text-overline text-muted-foreground">Avaliar estadia</p>
              <h1 className="text-h2 text-foreground mt-2">
                Como foi sua estadia {emPousada(review.pousadaName)} {review.pousadaName}?
              </h1>
              <p className="text-muted-foreground mt-2 inline-flex items-center gap-2 text-sm">
                <CalendarCheck className="size-4" />
                {formatISODate(review.checkin)} – {formatISODate(review.checkout)}
              </p>

              <div className="mt-8">
                {review.availability === 'available' && (
                  <StayReviewForm
                    bookingId={review.bookingId}
                    pousadaName={review.pousadaName}
                    pousadaSlug={review.pousadaSlug}
                    initialRating={rating}
                  />
                )}
                {review.availability === 'reviewed' && (
                  <Unavailable
                    icon={CircleCheck}
                    title="Você já avaliou esta estadia"
                    description="Obrigado! Sua avaliação já aparece na página da pousada."
                    slug={review.pousadaSlug}
                  />
                )}
                {review.availability === 'not_yet' && (
                  <Unavailable
                    icon={CalendarClock}
                    title="A avaliação abre no dia do check-out"
                    description={`Volte a partir de ${formatISODate(review.checkout)} para contar como foi.`}
                    slug={review.pousadaSlug}
                  />
                )}
                {review.availability === 'not_eligible' && (
                  <Unavailable
                    icon={CircleSlash}
                    title="Esta reserva não pode ser avaliada"
                    description="Avaliam a pousada só os hóspedes que reservaram pela Rota das Pousadas e concluíram a estadia."
                    slug={review.pousadaSlug}
                  />
                )}
              </div>
            </Card>
          )}
        </Container>
      </main>
      <SiteFooter />
    </div>
  )
}

function Unavailable({
  icon,
  title,
  description,
  slug,
}: {
  icon: typeof CircleCheck
  title: string
  description: string
  slug: string
}) {
  return (
    <EmptyState
      as="h2"
      icon={icon}
      title={title}
      description={description}
      className="px-0 py-6"
      action={
        <Link
          href={`/pousada/${slug}`}
          className={buttonVariants({ variant: 'outline', size: 'pill' })}
        >
          Ver a página da pousada
        </Link>
      }
    />
  )
}
