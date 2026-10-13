import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CalendarDays, ChevronRight } from 'lucide-react'
import { Logo } from '@/components/brand/logo'
import { isSupabaseConfigured } from '@/lib/env'
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
  // Modo demonstração (preview sem Supabase): abre a estadia de exemplo sem login.
  if (!user && isSupabaseConfigured()) redirect('/login?next=/estadia')

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
    <main id="conteudo" tabIndex={-1} className="bg-background min-h-dvh">
      <header className="bg-breu text-neblina rounded-b-3xl">
        <div className="mx-auto max-w-lg px-5 pt-[max(24px,env(safe-area-inset-top))] pb-8">
          <Logo className="h-5" title="Rota das Pousadas" />
          <h1 className="text-h1 mt-8">Minha estadia</h1>
        </div>
      </header>
      <div className="mx-auto max-w-lg space-y-3 px-5 py-6">
        {stays.length === 0 ? (
          <div className="bg-card rounded-3xl p-6 text-center">
            <p className="text-foreground font-semibold">Nenhuma estadia confirmada nesta conta</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Entre com a mesma conta usada na reserva. O app libera quando a reserva está
              confirmada.
            </p>
            <Link
              href="/minhas-reservas"
              className="text-foreground mt-3 inline-flex min-h-11 items-center text-sm font-semibold underline-offset-4 hover:underline"
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
                className="group bg-card hover:shadow-floating flex items-center justify-between gap-3 rounded-3xl p-5 transition-shadow duration-(--motion-hover)"
              >
                <span className="min-w-0">
                  <span className="text-h3 text-foreground block">{s.pousadaName}</span>
                  <span className="text-muted-foreground mt-1 flex items-center gap-1.5 text-sm">
                    <CalendarDays className="size-4 shrink-0" />
                    {formatISODate(s.checkin)} → {formatISODate(s.checkout)} · {s.roomName}
                  </span>
                </span>
                <ChevronRight className="text-muted-foreground group-hover:text-foreground size-5 shrink-0 transition-colors" />
              </Link>
            ))}
          </>
        )}
      </div>
    </main>
  )
}
