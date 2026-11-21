import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { isSupabaseConfigured } from '@/lib/env'
import { getCurrentUser, getMyOfferConsents } from '@/server/queries'
import { getStay } from '@/features/estadia/services/stay.service'
import { GuestStayApp } from '@/features/estadia/components/guest-stay-app'

export const dynamic = 'force-dynamic'

export default async function EstadiaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const user = await getCurrentUser()
  if (!user && isSupabaseConfigured()) {
    redirect(`/login?next=${encodeURIComponent(`/estadia/${id}`)}`)
  }

  let data
  try {
    data = await getStay(id)
  } catch (e) {
    console.error('[estadia] falha ao carregar', e)
    return (
      <main
        id="conteudo"
        tabIndex={-1}
        className="flex min-h-dvh items-center justify-center p-6 text-center"
      >
        <div>
          <p className="text-foreground font-semibold">Não foi possível abrir sua estadia agora</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Verifique a internet e tente de novo.
          </p>
          <Link
            href={`/estadia/${id}`}
            className="text-foreground mt-3 inline-flex min-h-11 items-center font-semibold underline-offset-4 hover:underline"
          >
            Tentar de novo
          </Link>
        </div>
      </main>
    )
  }
  if (!data) {
    return (
      <main
        id="conteudo"
        tabIndex={-1}
        className="flex min-h-dvh items-center justify-center p-6 text-center"
      >
        <div>
          <p className="text-foreground font-semibold">Esta estadia não é desta conta</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Entre com a conta usada na reserva para usar o app.
          </p>
          <Link
            href="/estadia"
            className="text-foreground mt-3 inline-flex min-h-11 items-center font-semibold underline-offset-4 hover:underline"
          >
            Ver minhas estadias
          </Link>
        </div>
      </main>
    )
  }

  // 0111: depois do check-out, o hóspede pode autorizar ofertas desta pousada.
  let offerConsent: boolean | null = null
  if (data.stay.booking.status === 'checked_out') {
    const consents = await getMyOfferConsents().catch(() => null)
    offerConsent = consents
      ? (consents.find((c) => c.pousadaId === data.stay.pousada.id)?.granted ?? false)
      : null
  }

  return <GuestStayApp stay={data.stay} orders={data.orders} offerConsent={offerConsent} />
}
