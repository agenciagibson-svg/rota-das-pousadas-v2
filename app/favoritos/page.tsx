import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { BellRing, Heart, MapPin, Radar, Star, TrendingDown } from 'lucide-react'
import { FavoriteAlertButton } from '@/components/favoritos/favorite-alert-button'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { Badge } from '@/components/ui/badge'
import { getCurrentUser, getMyFavoriteAlertStates, getMyFavorites } from '@/server/queries'
import { formatPrice } from '@/lib/format'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Favoritos | Rota das Pousadas',
  description: 'Suas pousadas salvas para comparar e reservar depois.',
}

export default async function FavoritosPage() {
  const user = await getCurrentUser()
  if (!user) redirect(`/login?next=${encodeURIComponent('/favoritos')}`)

  const [favorites, alertStates] = await Promise.all([getMyFavorites(), getMyFavoriteAlertStates()])
  const activeAlertBySlug = new Map(alertStates.map((alert) => [alert.slug, alert.active]))
  const activeAlertsCount = alertStates.filter((alert) => alert.active).length

  return (
    <div className="bg-background min-h-screen">
      <SiteHeader forceSolid />
      <main className="mx-auto max-w-7xl px-5 pt-28 pb-20 lg:px-8">
        <div className="border-border flex flex-col justify-between gap-6 border-b pb-8 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <span className="text-primary inline-flex items-center gap-2 text-sm font-semibold tracking-[0.2em] uppercase">
              <Heart className="fill-primary size-4" />
              Favoritos
            </span>
            <h1 className="text-foreground mt-3 font-serif text-4xl leading-tight font-semibold sm:text-5xl">
              Pousadas salvas para sua próxima rota
            </h1>
            <p className="text-muted-foreground mt-3">
              Compare opções com calma e ative alertas para saber quando surgir uma boa
              oportunidade.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row md:flex-col md:items-end">
            <div className="border-border bg-card text-muted-foreground rounded-2xl border px-4 py-3 text-sm">
              <span className="text-foreground font-semibold">{activeAlertsCount}</span> alertas
              ativos
            </div>
            <Link
              href="/pousadas"
              className="bg-primary text-primary-foreground inline-flex w-fit rounded-full px-5 py-3 text-sm font-semibold"
            >
              Explorar mais pousadas
            </Link>
          </div>
        </div>

        {favorites.length ? (
          <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {favorites.map((pousada) => (
              <article
                key={pousada.slug}
                className="group border-border bg-card hover:shadow-stone-deep/10 flex h-full flex-col overflow-hidden rounded-2xl border transition-all hover:-translate-y-1 hover:shadow-xl"
              >
                <Link
                  href={`/pousada/${pousada.slug}`}
                  className="relative aspect-[4/3] overflow-hidden"
                >
                  <Image
                    src={pousada.image || '/placeholder.svg'}
                    alt={pousada.name}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <span className="bg-card text-foreground absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold">
                    <Star className="fill-gold text-gold size-3.5" />
                    {pousada.rating.toFixed(1)}
                  </span>
                  <span className="bg-accent text-accent-foreground absolute top-3 right-3 flex size-9 items-center justify-center rounded-full">
                    <Heart className="size-4 fill-current" />
                  </span>
                </Link>

                <div className="flex flex-1 flex-col p-5">
                  <div className="text-muted-foreground flex items-center gap-1.5 text-sm">
                    <MapPin className="size-4" />
                    {pousada.city}, {pousada.state}
                  </div>
                  <h2 className="text-foreground mt-2 font-serif text-2xl font-semibold">
                    {pousada.name}
                  </h2>
                  <p className="text-muted-foreground mt-3 line-clamp-2 text-sm leading-relaxed">
                    {pousada.description}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {pousada.tags.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="secondary" size="sm">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <div className="border-border bg-secondary/35 mt-5 rounded-2xl border p-4">
                    <div className="flex items-start gap-3">
                      <span className="bg-card text-primary flex size-9 shrink-0 items-center justify-center rounded-full">
                        {activeAlertBySlug.get(pousada.slug) ? (
                          <BellRing className="size-4" />
                        ) : (
                          <Radar className="size-4" />
                        )}
                      </span>
                      <div>
                        <p className="text-foreground text-sm font-semibold">
                          Monitoramento da rota
                        </p>
                        <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                          Avisaremos quando esta pousada entrar em oferta ou ganhar uma janela
                          melhor.
                        </p>
                      </div>
                    </div>
                    <div className="text-muted-foreground mt-3 flex items-center gap-2 text-xs">
                      <TrendingDown className="text-accent size-3.5" />
                      Base pronta para e-mail, WhatsApp e notificações.
                    </div>
                  </div>
                  <div className="mt-auto flex items-end justify-between pt-5">
                    <div>
                      <span className="text-foreground text-lg font-semibold">
                        {formatPrice(pousada.pricePerNight)}
                      </span>
                      <span className="text-muted-foreground text-xs"> / diária</span>
                    </div>
                    <Link
                      href={`/pousada/${pousada.slug}`}
                      className="bg-primary text-primary-foreground hover:bg-accent rounded-full px-4 py-2 text-xs font-semibold transition-colors"
                    >
                      Ver detalhes
                    </Link>
                  </div>
                  <div className="mt-4">
                    <FavoriteAlertButton
                      slug={pousada.slug}
                      initialActive={Boolean(activeAlertBySlug.get(pousada.slug))}
                    />
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="border-border bg-card mt-10 rounded-2xl border border-dashed p-10 text-center">
            <span className="bg-secondary text-primary mx-auto flex size-12 items-center justify-center rounded-full">
              <Heart className="size-6" />
            </span>
            <h2 className="text-foreground mt-5 font-serif text-2xl font-semibold">
              Você ainda não salvou pousadas
            </h2>
            <p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm">
              Abra uma pousada e toque em Salvar. Ela aparece aqui para você comparar depois.
            </p>
            <Link
              href="/pousadas"
              className="bg-primary text-primary-foreground mt-5 inline-flex rounded-full px-5 py-2.5 text-sm font-semibold"
            >
              Ver pousadas
            </Link>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  )
}
