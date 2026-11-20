import Link from 'next/link'
import { CalendarDays } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatHolidayDate, formatRange, searchHref, type LongWeekend } from '../feriados'

/**
 * Lista de feriadões com o botão que abre a busca já com as datas. Com
 * `city`, a busca fica restrita à cidade.
 */
export function LongWeekendList({ weekends, city }: { weekends: LongWeekend[]; city?: string }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {weekends.map((w) => (
        <li key={`${w.slug}-${w.date}`} className="bg-card flex flex-col rounded-3xl p-5">
          <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
            <CalendarDays className="size-4" aria-hidden />
            {formatHolidayDate(w.date)}
          </p>
          <h3 className="text-h3 text-foreground mt-1">{w.name}</h3>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
            Folga de {formatRange(w.offStart, w.offEnd)}
            {w.bridge ? ', emendando um dia' : ''}. Sugestão: {w.nights} noites.
          </p>
          <Link
            href={searchHref(w, city)}
            className={cn(buttonVariants({ size: 'pill-sm' }), 'mt-4 w-fit')}
          >
            {city ? `Ver pousadas livres em ${city}` : 'Ver pousadas livres'}
          </Link>
        </li>
      ))}
    </ul>
  )
}
