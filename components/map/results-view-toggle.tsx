import Link from 'next/link'
import { List, Map as MapIcon } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type ResultsView = 'lista' | 'mapa'

/**
 * Alternância "Lista | Mapa" da busca. São links (`?ver=mapa`), não estado
 * do navegador: funciona sem JavaScript, volta com o botão Voltar e pode ser
 * compartilhada.
 */
export function ResultsViewToggle({
  current,
  listHref,
  mapHref,
}: {
  current: ResultsView
  listHref: string
  mapHref: string
}) {
  const options = [
    { view: 'lista' as const, href: listHref, label: 'Lista', Icon: List },
    { view: 'mapa' as const, href: mapHref, label: 'Mapa', Icon: MapIcon },
  ]
  return (
    <nav aria-label="Ver resultados em" className="bg-card flex w-fit gap-1 rounded-full p-1">
      {options.map(({ view, href, label, Icon }) => {
        const active = view === current
        return (
          <Link
            key={view}
            href={href}
            scroll={false}
            aria-current={active ? 'page' : undefined}
            className={cn(
              buttonVariants({ variant: active ? 'default' : 'ghost', size: 'pill-sm' }),
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
