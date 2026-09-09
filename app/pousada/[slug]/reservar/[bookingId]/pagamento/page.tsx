import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { SiteHeader } from '@/components/site-header'
import { Container } from '@/components/ui/container'
import { Card } from '@/components/ui/card'
import { getCurrentUser } from '@/server/queries'
import { createCheckoutPreference } from '@/features/pagamentos/services/checkout.service'

export const metadata: Metadata = {
  title: 'Pagamento',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function PagamentoPage({
  params,
}: {
  params: Promise<{ slug: string; bookingId: string }>
}) {
  const { slug, bookingId } = await params
  const user = await getCurrentUser()
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/pousada/${slug}/reservar/${bookingId}/pagamento`)}`)
  }

  let errorMessage: string | null = null
  let initPoint: string | null = null
  try {
    const preference = await createCheckoutPreference(bookingId)
    initPoint = preference.initPoint
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : 'Não foi possível iniciar o pagamento.'
  }

  if (initPoint) {
    redirect(initPoint)
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader forceSolid />
      <main className="pb-24 pt-28">
        <Container className="max-w-lg">
          <Card radius="3xl" className="p-6 text-center shadow-card">
            <h1 className="font-serif text-lg font-semibold text-foreground">Não foi possível continuar</h1>
            <p className="mt-2 text-sm text-muted-foreground">{errorMessage}</p>
            <Link
              href="/minhas-reservas"
              className="mt-6 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Ver minhas reservas
            </Link>
          </Card>
        </Container>
      </main>
    </div>
  )
}
