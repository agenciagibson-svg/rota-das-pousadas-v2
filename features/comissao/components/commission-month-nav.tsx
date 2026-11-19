import Link from 'next/link'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { monthLabel, monthParam } from '../commission'

/** Atalhos dos meses com comissão. O mês vai na URL (`?mes=2026-12`). */
export function CommissionMonthNav({
  months,
  current,
  basePath,
}: {
  months: readonly string[]
  current: string
  basePath: string
}) {
  if (months.length < 2) return null
  return (
    <nav aria-label="Mês do extrato" className="flex flex-wrap gap-2">
      {months.map((month) => {
        const active = monthParam(month) === monthParam(current)
        return (
          <Link
            key={month}
            href={`${basePath}?mes=${monthParam(month)}`}
            aria-current={active ? 'page' : undefined}
            className={cn(
              buttonVariants({ variant: active ? 'default' : 'outline', size: 'sm' }),
              'capitalize',
            )}
          >
            {monthLabel(month)}
          </Link>
        )
      })}
    </nav>
  )
}
