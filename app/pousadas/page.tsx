import Link from 'next/link'
import { Search } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { PousadaCard } from '@/components/pousada/pousada-card'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { SectionHeading } from '@/components/ui/section-heading'
import { cn } from '@/lib/utils'
import { getPousadas } from '@/server/queries'
import { PaginationLinks } from '@/components/ui/pagination'
import { formatISODate } from '@/lib/format'
import { catalogQuerySchema, singleParam } from '@/features/pousadas/search'
import { ResultsViewToggle, type ResultsView } from '@/components/map/results-view-toggle'
import { PousadasResultsMap, type MapResult } from '@/components/map/pousadas-results-map'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Todas as pousadas',
  description: 'Veja todas as pousadas publicadas e escolha uma hospedagem para reservar.',
}

export default async function PousadasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const query = await searchParams
  const [busca, checkin, checkout, hospedes, temporada, surpresa, oferta, pagina, ver] = [
    'busca',
    'checkin',
    'checkout',
    'hospedes',
    'temporada',
    'surpresa',
    'oferta',
    'pagina',
    'ver',
  ].map((key) => singleParam(query[key]))
  const view: ResultsView = ver === 'mapa' ? 'mapa' : 'lista'
  const parsed = catalogQuerySchema.safeParse({
    search: busca,
    checkin,
    checkout,
    guests: hospedes,
    page: pagina,
  })
  const result = parsed.success
    ? await getPousadas(parsed.data)
    : { items: [], total: 0, page: 1, pageSize: 24, totalPages: 1 }
  function pageHref(page: number) {
    const params = new URLSearchParams({ pagina: String(page) })
    for (const [key, value] of Object.entries({
      busca,
      checkin,
      checkout,
      hospedes,
      temporada,
      surpresa,
      oferta,
      ver: view === 'mapa' ? 'mapa' : undefined,
    })) {
      if (value) params.set(key, value)
    }
    return `/pousadas?${params}`
  }
  /** Mesma busca e mesma página, trocando só entre lista e mapa. */
  function viewHref(next: ResultsView) {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries({
      busca,
      checkin,
      checkout,
      hospedes,
      temporada,
      surpresa,
      oferta,
      pagina,
    })) {
      if (value) params.set(key, value)
    }
    if (next === 'mapa') params.set('ver', 'mapa')
    const qs = params.toString()
    return qs ? `/pousadas?${qs}` : '/pousadas'
  }
  const activeFilters = [
    surpresa === '1' ? 'Rota surpresa' : null,
    oferta === 'estacao' ? 'Oferta da estação' : null,
    busca ? `Destino: ${busca}` : null,
    checkin ? `Check-in: ${formatISODate(checkin)}` : null,
    checkout ? `Check-out: ${formatISODate(checkout)}` : null,
    hospedes ? `${hospedes} hóspede${hospedes === '1' ? '' : 's'}` : null,
    temporada ? `Estação: ${temporada}` : null,
  ].filter(Boolean)

  function pousadaHref(slug: string) {
    const params = new URLSearchParams()
    if (checkin) params.set('checkin', checkin)
    if (checkout) params.set('checkout', checkout)
    if (hospedes) params.set('guests', hospedes)
    const query = params.toString()
    return query ? `/pousada/${slug}?${query}` : `/pousada/${slug}`
  }

  // Só entra no mapa quem tem ponto marcado pelo dono (0095) — nada de
  // alfinete chutado no centro da cidade.
  const mapResults: MapResult[] = result.items.flatMap((pousada) =>
    pousada.coordinates
      ? [
          {
            slug: pousada.slug,
            name: pousada.name,
            city: pousada.city,
            state: pousada.state,
            image: pousada.image,
            price: pousada.pricePerNight,
            href: pousadaHref(pousada.slug),
            point: pousada.coordinates,
          },
        ]
      : [],
  )
  const withoutPoint = result.items.length - mapResults.length

  return (
    <div className="bg-background min-h-screen">
      <SiteHeader forceSolid />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-7xl px-5 pt-32 pb-20 lg:px-8">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <SectionHeading
            as="h1"
            eyebrow="Todas as pousadas"
            title="Escolha a pousada e veja os detalhes"
            description="A lista mostra as pousadas publicadas em sequência. Ao selecionar uma, você abre a página dela com fotos, informações e reserva."
          />

          <form action="/pousadas" role="search" className="w-full md:max-w-sm">
            <label htmlFor="catalogo-busca" className="sr-only">
              Buscar por nome ou cidade
            </label>
            <div className="bg-card focus-within:ring-ipe/60 flex h-14 items-center gap-3 rounded-full pr-2 pl-5 focus-within:ring-2">
              <Search className="text-muted-foreground size-5 shrink-0" />
              <input
                id="catalogo-busca"
                name="busca"
                type="search"
                enterKeyHint="search"
                autoComplete="off"
                defaultValue={busca}
                placeholder="Buscar por nome ou cidade"
                className="text-foreground placeholder:text-muted-foreground h-full min-w-0 flex-1 bg-transparent text-base outline-none"
              />
            </div>
            {checkin ? <input type="hidden" name="checkin" value={checkin} /> : null}
            {checkout ? <input type="hidden" name="checkout" value={checkout} /> : null}
            {hospedes ? <input type="hidden" name="hospedes" value={hospedes} /> : null}
            {temporada ? <input type="hidden" name="temporada" value={temporada} /> : null}
            {surpresa ? <input type="hidden" name="surpresa" value={surpresa} /> : null}
            {oferta ? <input type="hidden" name="oferta" value={oferta} /> : null}
          </form>
        </div>

        {surpresa === '1' ? (
          <div className="bg-breu text-neblina mt-8 flex flex-col gap-4 rounded-3xl p-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-h2">Sua rota surpresa está pronta</h2>
              <p className="text-liquen mt-1 text-base">
                Escolhemos uma direção para você explorar agora. Abra uma pousada e continue a
                reserva com as datas preenchidas.
              </p>
            </div>
            <Link
              href="/"
              className={cn(buttonVariants({ variant: 'inverse', size: 'pill' }), 'w-fit shrink-0')}
            >
              Sortear outra
            </Link>
          </div>
        ) : null}

        {oferta === 'estacao' ? (
          <div className="border-ipe/50 bg-ipe/15 mt-8 flex flex-col gap-4 rounded-3xl border p-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-h2 text-foreground">Oferta da estação selecionada</h2>
              <p className="text-muted-foreground mt-1 text-base">
                Mantivemos suas datas sugeridas e filtramos pousadas alinhadas com o clima da
                temporada.
              </p>
            </div>
            <Link
              href="/#ofertas"
              className={cn(buttonVariants({ size: 'pill' }), 'w-fit shrink-0')}
            >
              Trocar oferta
            </Link>
          </div>
        ) : null}

        <div className="border-border mt-8 flex flex-col gap-4 border-t pt-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-foreground text-base font-semibold" aria-live="polite">
              {result.total} pousada{result.total === 1 ? '' : 's'} encontrada
              {result.total === 1 ? '' : 's'}
            </p>
            {activeFilters.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {activeFilters.map((filter) => (
                  <Badge
                    key={filter}
                    variant="outline"
                    size="lg"
                    className="bg-card border-transparent"
                  >
                    {filter}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {result.items.length ? (
              <ResultsViewToggle
                current={view}
                listHref={viewHref('lista')}
                mapHref={viewHref('mapa')}
              />
            ) : null}
            {busca ? (
              <Link
                href="/pousadas"
                className={cn(buttonVariants({ variant: 'outline', size: 'pill-sm' }), 'w-fit')}
              >
                Limpar busca
              </Link>
            ) : null}
          </div>
        </div>

        {!parsed.success && (
          <p role="alert" className="text-destructive mt-6">
            {parsed.error.issues.find((issue) => issue.message.includes('noites'))?.message ??
              'Informe datas válidas de entrada e saída, quantidade de hóspedes e página.'}
          </p>
        )}
        {result.items.length && view === 'mapa' ? (
          <div className="mt-8">
            {mapResults.length ? (
              <PousadasResultsMap results={mapResults} />
            ) : (
              <Card radius="3xl" border={false} className="p-10 text-center">
                <h2 className="text-h2 text-foreground">Ainda sem pontos no mapa</h2>
                <p className="text-muted-foreground mt-2 text-base">
                  As pousadas desta lista ainda não marcaram a localização no mapa. Veja a lista.
                </p>
              </Card>
            )}
            {mapResults.length > 0 && withoutPoint > 0 && (
              <p className="text-muted-foreground mt-3 text-sm">
                {withoutPoint === 1
                  ? '1 pousada desta página ainda não marcou o ponto no mapa — ela aparece na lista.'
                  : `${withoutPoint} pousadas desta página ainda não marcaram o ponto no mapa — elas aparecem na lista.`}
              </p>
            )}
            {mapResults.length > 0 && result.totalPages > 1 && (
              <p className="text-muted-foreground mt-3 text-sm">
                O mapa mostra as pousadas desta página. Use a paginação abaixo para ver as outras.
              </p>
            )}
          </div>
        ) : result.items.length ? (
          <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {result.items.map((pousada) => (
              <li key={pousada.slug}>
                <PousadaCard
                  pousada={pousada}
                  href={pousadaHref(pousada.slug)}
                  cta="Ver pousada"
                  showDescription
                  showReviews
                  maxTags={4}
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                />
              </li>
            ))}
          </ul>
        ) : (
          <Card radius="3xl" border={false} className="mt-10 p-10 text-center">
            <h2 className="text-h2 text-foreground">Nenhuma pousada encontrada</h2>
            <p className="text-muted-foreground mt-2 text-base">
              Tente buscar por outro nome, cidade ou veja todas as pousadas novamente.
            </p>
            <Link href="/pousadas" className={cn(buttonVariants({ size: 'pill' }), 'mt-6')}>
              Ver todas
            </Link>
          </Card>
        )}
        <PaginationLinks page={result.page} totalPages={result.totalPages} href={pageHref} />
      </main>
      <SiteFooter />
    </div>
  )
}
