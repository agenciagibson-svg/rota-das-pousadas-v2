import Link from 'next/link'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { OwnerDashboardShell } from '@/components/dashboard/owner-shell'
import { Card } from '@/components/ui/card'
import { Button, buttonVariants } from '@/components/ui/button'
import { addDaysToISODate } from '@/lib/dates'
import { formatISODate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { WINDOW_OPTIONS, type OccupancyBoard } from '../occupancy'
import { OccupancyGrid } from './occupancy-grid'
import { OccupancyLegend } from './occupancy-legend'
import { ReservationsViewsNav } from './reservations-views-nav'

const BASE = '/dashboard/reservas/ocupacao'

function href(inicio: string | null, dias: number): string {
  const params = new URLSearchParams()
  if (inicio) params.set('inicio', inicio)
  if (dias !== 14) params.set('dias', String(dias))
  const q = params.toString()
  return q ? `${BASE}?${q}` : BASE
}

/** Mapa de ocupação da pousada (quartos × noites), com navegação pela janela. */
export function OwnerOccupancyView({
  displayName,
  pousadaName,
  board,
}: {
  displayName: string
  pousadaName: string
  board: OccupancyBoard
}) {
  const last = addDaysToISODate(board.from, board.days - 1)
  const step = 7
  const nav = buttonVariants({ variant: 'outline', size: 'touch' })
  return (
    <OwnerDashboardShell
      section="reservas"
      brandLabel={pousadaName}
      brandSub="Painel do proprietário"
      title="Reservas"
      subtitle="Ocupação por quarto: arraste para mudar, clique num dia livre para reservar."
      user={{ name: displayName, role: 'Proprietário' }}
    >
      <div className="mb-5">
        <ReservationsViewsNav current="ocupacao" />
      </div>

      <Card className="p-4 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-foreground font-semibold">Mapa de ocupação</h2>
            <p className="text-muted-foreground text-sm">
              {formatISODate(board.from)} a {formatISODate(last)} · cada coluna é uma noite
            </p>
          </div>
          <Link href="/dashboard/reservas/nova" className={buttonVariants({ size: 'touch' })}>
            <Plus className="size-4" aria-hidden />
            Nova reserva
          </Link>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Link
            href={href(addDaysToISODate(board.from, -step), board.days)}
            aria-label={`${step} dias antes`}
            className={nav}
          >
            <ChevronLeft className="size-4" aria-hidden />
          </Link>
          <Link href={href(null, board.days)} className={nav}>
            Hoje
          </Link>
          <Link
            href={href(addDaysToISODate(board.from, step), board.days)}
            aria-label={`${step} dias depois`}
            className={nav}
          >
            <ChevronRight className="size-4" aria-hidden />
          </Link>
          <div
            className="bg-secondary inline-flex rounded-lg p-1"
            role="group"
            aria-label="Dias na tela"
          >
            {WINDOW_OPTIONS.map((d) => (
              <Link
                key={d}
                href={href(board.from, d)}
                aria-current={board.days === d ? 'true' : undefined}
                className={cn(
                  buttonVariants({ variant: 'ghost', size: 'touch' }),
                  'h-9',
                  board.days === d && 'bg-card hover:bg-card shadow-sm',
                )}
              >
                {d} dias
              </Link>
            ))}
          </div>
          <form method="get" action={BASE} className="flex items-center gap-2">
            {board.days !== 14 && <input type="hidden" name="dias" value={board.days} />}
            <label className="sr-only" htmlFor="ocupacao-inicio">
              Começar em
            </label>
            <input
              id="ocupacao-inicio"
              type="date"
              name="inicio"
              defaultValue={board.from}
              className="border-input bg-card text-foreground h-11 rounded-lg border px-3 text-sm"
            />
            <Button type="submit" variant="outline" size="touch">
              Ir
            </Button>
          </form>
        </div>

        <div className="mt-4">
          {board.rooms.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Cadastre um quarto ativo em Acomodações para ver o mapa de ocupação.
            </p>
          ) : (
            <OccupancyGrid board={board} />
          )}
        </div>
        <OccupancyLegend />
      </Card>
    </OwnerDashboardShell>
  )
}
