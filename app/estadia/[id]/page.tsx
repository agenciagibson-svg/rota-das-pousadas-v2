import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getCurrentUser } from '@/server/queries'
import { getStay } from '@/features/estadia/services/stay.service'
import { GuestStayApp } from '@/features/estadia/components/guest-stay-app'

export const dynamic = 'force-dynamic'

export default async function EstadiaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const user = await getCurrentUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(`/estadia/${id}`)}`)

  let data
  try {
    data = await getStay(id)
  } catch (e) {
    console.error('[estadia] falha ao carregar', e)
    return (
      <main className="flex min-h-dvh items-center justify-center p-6 text-center">
        <div>
          <p className="text-foreground font-semibold">Não foi possível abrir sua estadia agora</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Verifique a internet e tente de novo.
          </p>
          <Link href={`/estadia/${id}`} className="text-primary mt-3 inline-block font-semibold">
            Tentar de novo
          </Link>
        </div>
      </main>
    )
  }
  if (!data) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-6 text-center">
        <div>
          <p className="text-foreground font-semibold">Esta estadia não é desta conta</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Entre com a conta usada na reserva para usar o app.
          </p>
          <Link href="/estadia" className="text-primary mt-3 inline-block font-semibold">
            Ver minhas estadias
          </Link>
        </div>
      </main>
    )
  }

  return <GuestStayApp stay={data.stay} orders={data.orders} />
}
