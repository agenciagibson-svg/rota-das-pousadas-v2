import Link from 'next/link'
import { CalendarDays } from 'lucide-react'
import { PousadaCard } from '@/components/pousada/pousada-card'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatRange, searchHref } from '@/features/feriados/feriados'
import { cn } from '@/lib/utils'
import type { HolidayStays } from '../services/holiday-stays.service'

/**
 * "Próximo feriadão" dentro do guia: as pousadas da cidade com vaga nas datas
 * (disponibilidade real) ou, sem nenhuma, o atalho para a busca já com as datas.
 */
export function HolidayBox({ city, holiday }: { city: string; holiday: HolidayStays }) {
  const { weekend, stays } = holiday
  const dates = new URLSearchParams({
    checkin: weekend.checkin,
    checkout: weekend.checkout,
    guests: '2',
  }).toString()
  return (
    <Card radius="3xl" className="mt-6 p-6">
      <div className="flex items-start gap-4">
        <span className="bg-accent/20 text-foreground flex size-12 shrink-0 items-center justify-center rounded-2xl">
          <CalendarDays className="size-6" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-muted-foreground text-sm font-semibold">Próximo feriadão</p>
          <p className="text-foreground text-lg font-semibold">
            {weekend.name}: {formatRange(weekend.offStart, weekend.offEnd)}
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            {stays.length > 0
              ? `Pousadas em ${city} com vaga nessas datas, para 2 pessoas.`
              : `Veja quem ainda tem vaga em ${city} nessas datas.`}
          </p>
        </div>
      </div>
      {stays.length > 0 && (
        <ul className="mt-6 grid gap-6 sm:grid-cols-2">
          {stays.map((pousada) => (
            <li key={pousada.slug}>
              <PousadaCard
                pousada={pousada}
                href={`/pousada/${pousada.slug}?${dates}`}
                cta="Ver vaga"
                maxTags={2}
                sizes="(max-width: 640px) 100vw, 384px"
              />
            </li>
          ))}
        </ul>
      )}
      <Link
        href={searchHref(weekend, city)}
        className={cn(
          buttonVariants({ size: 'pill', variant: stays.length ? 'outline' : 'accent' }),
          'mt-6 w-fit',
        )}
      >
        {stays.length ? 'Ver todas com vaga no feriadão' : `Buscar pousadas em ${city} no feriadão`}
      </Link>
    </Card>
  )
}
