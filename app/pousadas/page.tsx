import Image from 'next/image'
import Link from 'next/link'
import { MapPin, Search, Star } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { Badge } from '@/components/ui/badge'
import { getPousadas } from '@/server/queries'
import { PaginationLinks } from '@/components/ui/pagination'
import { catalogQuerySchema } from '@/features/pousadas/search'
import { formatPrice } from '@/lib/format'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Todas as pousadas | Rota das Pousadas',
  description: 'Veja todas as pousadas publicadas e escolha uma hospedagem para reservar.',
}

export default async function PousadasPage({
  searchParams,
}: {
  searchParams: Promise<{
    busca?: string
    checkin?: string
    checkout?: string
    hospedes?: string
    temporada?: string
    surpresa?: string
    oferta?: string
    pagina?: string
  }>
}) {
  const { busca, checkin, checkout, hospedes, temporada, surpresa, oferta, pagina } =
    await searchParams
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
    })) {
      if (value) params.set(key, value)
    }
    return `/pousadas?${params}`
  }
  const activeFilters = [
    surpresa === '1' ? 'Rota surpresa' : null,
    oferta === 'estacao' ? 'Oferta da estação' : null,
    busca ? `Destino: ${busca}` : null,
    checkin ? `Check-in: ${checkin}` : null,
    checkout ? `Check-out: ${checkout}` : null,
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

  return (
    <div className="bg-background min-h-screen">
      <SiteHeader forceSolid />
      <main className="mx-auto max-w-7xl px-5 pt-28 pb-20 lg:px-8">
        <div className="border-border flex flex-col justify-between gap-6 border-b pb-8 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <span className="text-primary text-sm font-semibold tracking-[0.2em] uppercase">
              Todas as pousadas
            </span>
            <h1 className="text-foreground mt-3 font-serif text-4xl leading-tight font-semibold sm:text-5xl">
              Escolha a pousada e veja os detalhes
            </h1>
            <p className="text-muted-foreground mt-3">
              A lista mostra as pousadas publicadas em sequência. Ao selecionar uma, você abre a
              página dela com fotos, informações e reserva.
            </p>
          </div>

          <form action="/pousadas" className="relative w-full md:max-w-sm">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2" />
            <input
              name="busca"
              defaultValue={busca}
              placeholder="Buscar por nome ou cidade"
              className="border-border bg-card focus:border-primary h-12 w-full rounded-full border pr-4 pl-11 text-sm transition-colors outline-none"
            />
            {checkin ? <input type="hidden" name="checkin" value={checkin} /> : null}
            {checkout ? <input type="hidden" name="checkout" value={checkout} /> : null}
            {hospedes ? <input type="hidden" name="hospedes" value={hospedes} /> : null}
            {temporada ? <input type="hidden" name="temporada" value={temporada} /> : null}
            {surpresa ? <input type="hidden" name="surpresa" value={surpresa} /> : null}
            {oferta ? <input type="hidden" name="oferta" value={oferta} /> : null}
          </form>
        </div>

        {surpresa === '1' ? (
          <div className="border-primary/20 bg-primary/5 mt-8 rounded-2xl border p-5">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-foreground font-serif text-2xl font-semibold">
                  Sua rota surpresa está pronta
                </h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  Escolhemos uma direção para você explorar agora. Abra uma pousada e continue a
                  reserva com as datas preenchidas.
                </p>
              </div>
              <Link
                href="/"
                className="bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-primary/20 inline-flex w-fit rounded-full px-4 py-2 text-sm font-semibold transition-all hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0"
              >
                Sortear outra
              </Link>
            </div>
          </div>
        ) : null}

        {oferta === 'estacao' ? (
          <div className="border-accent/20 bg-accent/5 mt-8 rounded-2xl border p-5">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-foreground font-serif text-2xl font-semibold">
                  Oferta da estação selecionada
                </h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  Mantivemos suas datas sugeridas e filtramos pousadas alinhadas com o clima da
                  temporada.
                </p>
              </div>
              <Link
                href="/#ofertas"
                className="bg-accent text-accent-foreground hover:bg-accent/90 hover:shadow-accent/20 inline-flex w-fit rounded-full px-4 py-2 text-sm font-semibold transition-all hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0"
              >
                Trocar oferta
              </Link>
            </div>
          </div>
        ) : null}

        <div className="text-muted-foreground mt-8 flex flex-col gap-4 text-sm md:flex-row md:items-center md:justify-between">
          <div>
            <span>
              {result.total} pousada{result.total === 1 ? '' : 's'} encontrada
              {result.total === 1 ? '' : 's'}
            </span>
            {activeFilters.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {activeFilters.map((filter) => (
                  <span
                    key={filter}
                    className="border-border bg-card text-foreground rounded-full border px-3 py-1 text-xs font-medium"
                  >
                    {filter}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          {busca ? (
            <Link href="/pousadas" className="text-primary font-semibold hover:underline">
              Limpar busca
            </Link>
          ) : null}
        </div>

        {!parsed.success && (
          <p role="alert" className="text-destructive mt-6">
            Informe datas válidas de entrada e saída, quantidade de hóspedes e página.
          </p>
        )}
        {result.items.length ? (
          <div className="mt-8 grid grid-cols-1 gap-5">
            {result.items.map((pousada) => (
              <Link
                key={pousada.slug}
                href={pousadaHref(pousada.slug)}
                className="group border-border bg-card hover:shadow-stone-deep/10 grid overflow-hidden rounded-2xl border transition-all hover:-translate-y-0.5 hover:shadow-xl md:grid-cols-[280px_1fr]"
              >
                <div className="relative aspect-[4/3] md:aspect-auto md:min-h-52">
                  <Image
                    src={pousada.image || '/placeholder.svg'}
                    alt={pousada.name}
                    fill
                    sizes="(max-width: 768px) 100vw, 280px"
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                </div>

                <div className="flex min-w-0 flex-col gap-4 p-5 md:p-6">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-sm">
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="size-4" />
                          {pousada.city}, {pousada.state}
                        </span>
                        <span className="text-foreground inline-flex items-center gap-1.5 font-semibold">
                          <Star className="fill-gold text-gold size-4" />
                          {pousada.rating.toFixed(1)}
                          <span className="text-muted-foreground font-normal">
                            ({pousada.reviews} avaliações)
                          </span>
                        </span>
                      </div>
                      <h2 className="text-foreground mt-2 font-serif text-2xl font-semibold">
                        {pousada.name}
                      </h2>
                    </div>
                    <div className="shrink-0 md:text-right">
                      <div className="text-foreground text-xl font-semibold">
                        {formatPrice(pousada.pricePerNight)}
                      </div>
                      <div className="text-muted-foreground text-xs">/ diária</div>
                    </div>
                  </div>

                  <p className="text-muted-foreground line-clamp-2 text-sm leading-relaxed">
                    {pousada.description}
                  </p>

                  <div className="mt-auto flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div className="flex flex-wrap gap-2">
                      {pousada.tags.slice(0, 4).map((tag) => (
                        <Badge key={tag} variant="secondary" size="sm">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    <span className="bg-primary text-primary-foreground group-hover:bg-accent group-hover:text-accent-foreground inline-flex w-fit rounded-full px-5 py-2.5 text-sm font-semibold transition-colors">
                      Ver pousada
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="border-border bg-card mt-10 rounded-2xl border border-dashed p-10 text-center">
            <h2 className="text-foreground font-serif text-2xl font-semibold">
              Nenhuma pousada encontrada
            </h2>
            <p className="text-muted-foreground mt-2 text-sm">
              Tente buscar por outro nome, cidade ou veja todas as pousadas novamente.
            </p>
            <Link
              href="/pousadas"
              className="bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-primary/20 mt-5 inline-flex rounded-full px-5 py-2.5 text-sm font-semibold transition-all hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0"
            >
              Ver todas
            </Link>
          </div>
        )}
        <PaginationLinks page={result.page} totalPages={result.totalPages} href={pageHref} />
      </main>
      <SiteFooter />
    </div>
  )
}
