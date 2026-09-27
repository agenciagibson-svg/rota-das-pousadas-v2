import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CalendarDays, Compass } from 'lucide-react'
import { getCurrentUser } from '@/server/queries'
import { listMyStays } from '@/features/estadia/services/stay.service'
import { formatISODate } from '@/lib/format'

export const dynamic = 'force-dynamic'

/**
 * Porta de entrada do app (QR do quarto e ícone da tela inicial): leva direto
 * para a estadia em curso; com mais de uma, deixa escolher.
 */
export default async function EstadiaIndexPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login?next=/estadia')

  const stays = await listMyStays()
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(
    new Date(),
  )
  const current = stays.filter(
    (s) => s.checkin <= today && s.checkout >= today && s.status !== 'checked_out',
  )
  if (current.length === 1) redirect(`/estadia/${current[0]!.id}`)
  if (current.length === 0 && stays.length === 1) redirect(`/estadia/${stays[0]!.id}`)

  return (
    <main className="bg-background min-h-dvh">
      <header className="bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-6">
          <Compass className="size-7" />
          <div>
            <p className="text-xs font-semibold tracking-widest uppercase opacity-80">
              Rota das Pousadas
            </p>
            <h1 className="font-serif text-2xl font-semibold">Minha estadia</h1>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-lg space-y-3 px-4 py-6">
        {stays.length === 0 ? (
          <div className="bg-card border-border rounded-2xl border p-5 text-center">
            <p className="text-foreground font-semibold">Nenhuma estadia confirmada nesta conta</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Entre com a mesma conta usada na reserva. O app libera quando a reserva está
              confirmada.
            </p>
            <Link
              href="/minhas-reservas"
              className="text-primary mt-3 inline-block text-sm font-semibold"
            >
              Ver minhas reservas →
            </Link>
          </div>
        ) : (
          <>
            <p className="text-muted-foreground text-sm">Escolha a estadia:</p>
            {stays.map((s) => (
              <Link
                key={s.id}
                href={`/estadia/${s.id}`}
                className="bg-card border-border hover:border-primary block rounded-2xl border p-4"
              >
                <p className="text-foreground font-semibold">{s.pousadaName}</p>
                <p className="text-muted-foreground mt-1 flex items-center gap-1.5 text-sm">
                  <CalendarDays className="size-4" />
                  {formatISODate(s.checkin)} → {formatISODate(s.checkout)} · {s.roomName}
                </p>
              </Link>
            ))}
          </>
        )}
      </div>
    </main>
  )
}
