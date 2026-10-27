import Link from 'next/link'
import { CalendarRange, List } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Troca entre as duas visões de Reservas: a lista (com o calendário por
 * quarto) e o mapa de ocupação. São páginas, então é navegação (links com
 * `aria-current`), não abas de conteúdo.
 */
export function ReservationsViewsNav({ current }: { current: 'lista' | 'ocupacao' }) {
  const items = [
    { key: 'lista', href: '/dashboard/reservas', label: 'Lista e calendário', icon: List },
    {
      key: 'ocupacao',
      href: '/dashboard/reservas/ocupacao',
      label: 'Mapa de ocupação',
      icon: CalendarRange,
    },
  ] as const
  return (
    <nav
      aria-label="Visões das reservas"
      className="bg-secondary inline-flex gap-1 rounded-full p-1"
    >
      {items.map(({ key, href, label, icon: Icon }) => {
        const active = key === current
        return (
          <Link
            key={key}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              buttonVariants({ variant: 'ghost', size: 'touch' }),
              'rounded-full',
              active && 'bg-card text-foreground hover:bg-card shadow-sm',
              !active && 'text-muted-foreground',
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
