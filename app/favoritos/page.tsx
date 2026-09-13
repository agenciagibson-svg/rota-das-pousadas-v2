import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { BellRing, Heart, MapPin, Radar, Star, TrendingDown } from 'lucide-react'
import { FavoriteAlertButton } from '@/components/favoritos/favorite-alert-button'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { Badge } from '@/components/ui/badge'
import { getCurrentUser, getMyFavoriteAlertStates, getMyFavorites } from '@/server/queries'

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
    <div className="min-h-screen bg-background">
      <SiteHeader forceSolid />
      <main className="mx-auto max-w-7xl px-5 pb-20 pt-28 lg:px-8">
        <div className="flex flex-col justify-between gap-6 border-b border-border pb-8 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-primary">
              <Heart className="size-4 fill-primary" />
              Favoritos
            </span>
            <h1 className="mt-3 font-serif text-4xl font-semibold leading-tight text-foreground sm:text-5xl">
              Pousadas salvas para sua próxima rota
            </h1>
            <p className="mt-3 text-muted-foreground">
              Compare opções com calma e ative alertas para saber quando surgir uma boa oportunidade.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row md:flex-col md:items-end">
            <div className="rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{activeAlertsCount}</span> alertas ativos
            </div>
            <Link
              href="/pousadas"
              className="inline-flex w-fit rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
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
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-stone-deep/10"
              >
                <Link href={`/pousada/${pousada.slug}`} className="relative aspect-[4/3] overflow-hidden">
                  <Image
                    src={pousada.image || '/placeholder.svg'}
                    alt={pousada.name}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1 text-xs font-semibold text-foreground">
                    <Star className="size-3.5 fill-gold text-gold" />
                    {pousada.rating.toFixed(1)}
                  </span>
                  <span className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full bg-accent text-accent-foreground">
                    <Heart className="size-4 fill-current" />
                  </span>
                </Link>

                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="size-4" />
                    {pousada.city}, {pousada.state}
                  </div>
                  <h2 className="mt-2 font-serif text-2xl font-semibold text-foreground">{pousada.name}</h2>
                  <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                    {pousada.description}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {pousada.tags.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="secondary" size="sm">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <div className="mt-5 rounded-2xl border border-border bg-secondary/35 p-4">
                    <div className="flex items-start gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-card text-primary">
                        {activeAlertBySlug.get(pousada.slug) ? (
                          <BellRing className="size-4" />
                        ) : (
                          <Radar className="size-4" />
                        )}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-foreground">Monitoramento da rota</p>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          Avisaremos quando esta pousada entrar em oferta ou ganhar uma janela melhor.
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                      <TrendingDown className="size-3.5 text-accent" />
                      Base pronta para e-mail, WhatsApp e notificações.
                    </div>
                  </div>
                  <div className="mt-auto flex items-end justify-between pt-5">
                    <div>
                      <span className="text-lg font-semibold text-foreground">R$ {pousada.pricePerNight}</span>
                      <span className="text-xs text-muted-foreground"> / diária</span>
                    </div>
                    <Link
                      href={`/pousada/${pousada.slug}`}
                      className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-accent"
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
          <div className="mt-10 rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-secondary text-primary">
              <Heart className="size-6" />
            </span>
            <h2 className="mt-5 font-serif text-2xl font-semibold text-foreground">
              Você ainda não salvou pousadas
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Abra uma pousada e toque em Salvar. Ela aparece aqui para você comparar depois.
            </p>
            <Link
              href="/pousadas"
              className="mt-5 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
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
