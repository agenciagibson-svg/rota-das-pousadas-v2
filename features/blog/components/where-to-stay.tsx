import Link from 'next/link'
import { PousadaCard } from '@/components/pousada/pousada-card'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Pousada } from '@/types'
import type { HolidayStays } from '../services/holiday-stays.service'
import { HolidayBox } from './holiday-box'

/** "Onde ficar" do guia: próximo feriadão com vaga + pousadas da Rota na cidade. */
export function WhereToStay({
  city,
  stays,
  holiday,
}: {
  city: { slug: string; name: string }
  stays: Pousada[]
  holiday: HolidayStays | null
}) {
  // Quem já aparece com vaga no feriadão não se repete na lista de baixo.
  const shown = new Set(holiday?.stays.map((p) => p.slug))
  const others = stays.filter((p) => !shown.has(p.slug))
  const allLink = (
    <Link
      href={`/destinos/${city.slug}`}
      className="text-foreground mt-4 inline-flex text-sm font-semibold underline underline-offset-4"
    >
      Todas as pousadas em {city.name}
    </Link>
  )
  return (
    <section aria-labelledby="onde-ficar" className="mt-14">
      <h2 id="onde-ficar" className="text-h2 text-foreground">
        Onde ficar em {city.name}
      </h2>
      {holiday && <HolidayBox city={city.name} holiday={holiday} />}
      {others.length > 0 ? (
        <>
          <ul className="mt-6 grid gap-6 sm:grid-cols-2">
            {others.map((pousada) => (
              <li key={pousada.slug}>
                <PousadaCard
                  pousada={pousada}
                  href={`/pousada/${pousada.slug}`}
                  cta="Ver pousada"
                  showReviews
                  maxTags={3}
                  sizes="(max-width: 640px) 100vw, 384px"
                />
              </li>
            ))}
          </ul>
          {allLink}
        </>
      ) : stays.length > 0 ? (
        allLink
      ) : (
        !holiday && (
          <div className="bg-card mt-4 rounded-2xl p-6">
            <p className="text-muted-foreground text-base">
              Reserve direto com a pousada, sem intermediário, e pague por Pix ou cartão.
            </p>
            <Link
              href={`/pousadas?busca=${encodeURIComponent(city.name)}`}
              className={cn(buttonVariants({ size: 'pill' }), 'mt-4 w-fit')}
            >
              Ver pousadas em {city.name}
            </Link>
          </div>
        )
      )}
    </section>
  )
}
