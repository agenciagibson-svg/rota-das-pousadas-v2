import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { SectionHeading } from '@/components/ui/section-heading'
import { buttonVariants } from '@/components/ui/button'
import { absoluteUrl } from '@/lib/seo'
import { isoDateInTimeZone } from '@/lib/dates'
import { getCityDestinations } from '@/server/queries'
import { searchHref, upcomingLongWeekends } from '@/features/feriados/feriados'
import { LongWeekendList } from '@/features/feriados/components/long-weekend-list'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const year = Number(isoDateInTimeZone(new Date()).slice(0, 4))
  const title = `Próximos feriados para viajar (${year}–${year + 1})`
  const description =
    'Os próximos feriadões do Brasil com as datas da folga, onde emendar e pousadas livres para reservar direto, sem intermediário.'
  return {
    title,
    description,
    alternates: { canonical: '/feriados' },
    openGraph: { type: 'website', url: absoluteUrl('/feriados'), title, description },
  }
}

export default async function FeriadosPage() {
  const today = isoDateInTimeZone(new Date())
  const weekends = upcomingLongWeekends(today, 9)
  const cities = (await getCityDestinations()).slice(0, 8)
  const next = weekends[0]

  return (
    <div className="bg-background min-h-screen">
      <SiteHeader forceSolid />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-7xl px-5 pt-32 pb-20 lg:px-8">
        <Breadcrumb items={[{ label: 'Início', href: '/' }, { label: 'Feriados' }]} />
        <SectionHeading
          as="h1"
          className="mt-6"
          eyebrow="Feriados"
          title="Próximos feriados para viajar"
          description="Veja quando cai cada feriado nacional, quantos dias de folga dá (com a emenda, quando cai na terça ou na quinta) e as pousadas livres nessas datas."
        />

        <div className="mt-10">
          <LongWeekendList weekends={weekends} />
        </div>

        {next && cities.length > 0 && (
          <section aria-labelledby="por-cidade" className="mt-16">
            <h2 id="por-cidade" className="text-h2 text-foreground">
              {next.name}: pousadas livres por cidade
            </h2>
            <ul className="mt-4 flex flex-wrap gap-2">
              {cities.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={searchHref(next, c.city)}
                    className={buttonVariants({ variant: 'outline', size: 'pill-sm' })}
                  >
                    {c.city}, {c.state}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="text-muted-foreground mt-12 max-w-3xl text-sm leading-relaxed">
          Carnaval e Corpus Christi são ponto facultativo nacional, mas a maioria folga. Feriados
          estaduais e municipais não entram na lista; confira os da cidade de destino.
        </p>
      </main>
      <SiteFooter />
    </div>
  )
}
