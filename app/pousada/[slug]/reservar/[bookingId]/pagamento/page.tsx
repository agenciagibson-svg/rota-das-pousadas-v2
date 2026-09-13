import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { FormPageShell } from '@/components/layout/form-page-shell'
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
    redirect(
      `/login?next=${encodeURIComponent(`/pousada/${slug}/reservar/${bookingId}/pagamento`)}`,
    )
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
    <FormPageShell
      eyebrow="Pagamento"
      title="Não foi possível continuar"
      description={errorMessage ?? undefined}
    >
      <div className="text-center">
        <Link
          href="/minhas-reservas"
          className="bg-primary text-primary-foreground inline-flex rounded-full px-6 py-3 text-base font-semibold"
        >
          Ver minhas reservas
        </Link>
      </div>
    </FormPageShell>
  )
}
