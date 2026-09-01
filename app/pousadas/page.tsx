import Image from 'next/image'
import Link from 'next/link'
import { MapPin, Search, Star } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { Badge } from '@/components/ui/badge'
import { getPousadas } from '@/server/queries'

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
  }>
}) {
  const { busca, checkin, checkout, hospedes, temporada, surpresa, oferta } = await searchParams
  const result = await getPousadas({ search: busca, pageSize: 100 })
  const activeFilters = [
    surpresa === '1' ? 'Rota surpresa' : null,
    oferta === 'estacao' ? 'Oferta da estacao' : null,
    busca ? `Destino: ${busca}` : null,
    checkin ? `Check-in: ${checkin}` : null,
    checkout ? `Check-out: ${checkout}` : null,
    hospedes ? `${hospedes} hospede${hospedes === '1' ? '' : 's'}` : null,
    temporada ? `Estacao: ${temporada}` : null,
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
    <div className="min-h-screen bg-background">
      <SiteHeader forceSolid />
      <main className="mx-auto max-w-7xl px-5 pb-20 pt-28 lg:px-8">
        <div className="flex flex-col justify-between gap-6 border-b border-border pb-8 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <span className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
              Todas as pousadas
            </span>
            <h1 className="mt-3 font-serif text-4xl font-semibold leading-tight text-foreground sm:text-5xl">
              Escolha a pousada e veja os detalhes
            </h1>
            <p className="mt-3 text-muted-foreground">
              A lista mostra as pousadas publicadas em sequencia. Ao selecionar uma, voce abre a
              pagina dela com fotos, informacoes e reserva.
            </p>
          </div>

          <form action="/pousadas" className="relative w-full md:max-w-sm">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              name="busca"
              defaultValue={busca}
              placeholder="Buscar por nome ou cidade"
              className="h-12 w-full rounded-full border border-border bg-card pl-11 pr-4 text-sm outline-none transition-colors focus:border-primary"
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
          <div className="mt-8 rounded-2xl border border-primary/20 bg-primary/5 p-5">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="font-serif text-2xl font-semibold text-foreground">
                  Sua rota surpresa esta pronta
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Escolhemos uma direcao para voce explorar agora. Abra uma pousada e continue a reserva com as datas preenchidas.
                </p>
              </div>
              <Link
                href="/"
                className="inline-flex w-fit rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
              >
                Sortear outra
              </Link>
            </div>
          </div>
        ) : null}

        {oferta === 'estacao' ? (
          <div className="mt-8 rounded-2xl border border-accent/20 bg-accent/5 p-5">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="font-serif text-2xl font-semibold text-foreground">
                  Oferta da estacao selecionada
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Mantivemos suas datas sugeridas e filtramos pousadas alinhadas com o clima da temporada.
                </p>
              </div>
              <Link
                href="/#ofertas"
                className="inline-flex w-fit rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground"
              >
                Trocar oferta
              </Link>
            </div>
          </div>
        ) : null}

        <div className="mt-8 flex flex-col gap-4 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
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
                    className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground"
                  >
                    {filter}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          {busca ? (
            <Link href="/pousadas" className="font-semibold text-primary hover:underline">
              Limpar busca
            </Link>
          ) : null}
        </div>

        {result.items.length ? (
          <div className="mt-8 grid grid-cols-1 gap-5">
            {result.items.map((pousada) => (
              <Link
                key={pousada.slug}
                href={pousadaHref(pousada.slug)}
                className="group grid overflow-hidden rounded-2xl border border-border bg-card transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-stone-deep/10 md:grid-cols-[280px_1fr]"
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
                      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="size-4" />
                          {pousada.city}, {pousada.state}
                        </span>
                        <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
                          <Star className="size-4 fill-gold text-gold" />
                          {pousada.rating.toFixed(1)}
                          <span className="font-normal text-muted-foreground">
                            ({pousada.reviews} avaliacoes)
                          </span>
                        </span>
                      </div>
                      <h2 className="mt-2 font-serif text-2xl font-semibold text-foreground">
                        {pousada.name}
                      </h2>
                    </div>
                    <div className="shrink-0 md:text-right">
                      <div className="text-xl font-semibold text-foreground">
                        R$ {pousada.pricePerNight}
                      </div>
                      <div className="text-xs text-muted-foreground">/ diaria</div>
                    </div>
                  </div>

                  <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
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
                    <span className="inline-flex w-fit rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors group-hover:bg-accent group-hover:text-accent-foreground">
                      Ver pousada
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-10 rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <h2 className="font-serif text-2xl font-semibold text-foreground">
              Nenhuma pousada encontrada
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Tente buscar por outro nome, cidade ou veja todas as pousadas novamente.
            </p>
            <Link
              href="/pousadas"
              className="mt-5 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Ver todas
            </Link>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  )
}
