import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { BellRing, Heart, Radar, Star, TrendingDown } from 'lucide-react'
import { FavoriteAlertButton } from '@/components/favoritos/favorite-alert-button'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { SectionHeading } from '@/components/ui/section-heading'
import { cn } from '@/lib/utils'
import { getCurrentUser, getMyFavoriteAlertStates, getMyFavorites } from '@/server/queries'
import { formatPrice } from '@/lib/format'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Favoritos',
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
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-7xl px-5 pt-32 pb-20 lg:px-8">
        <div className="border-border flex flex-col justify-between gap-6 border-b pb-8 md:flex-row md:items-end">
          <SectionHeading
            as="h1"
            eyebrow="Favoritos"
            title="Pousadas salvas para sua próxima rota"
            description="Compare opções com calma e ative alertas para saber quando surgir uma boa oportunidade."
          />
          <div className="flex flex-wrap items-center gap-3 md:flex-col md:items-end">
            <div className="bg-card text-muted-foreground rounded-full px-4 py-3 text-sm">
              <span className="text-foreground font-semibold tabular-nums">
                {activeAlertsCount}
              </span>{' '}
              alertas ativos
            </div>
            <Link href="/pousadas" className={cn(buttonVariants({ size: 'pill' }), 'w-fit')}>
              Explorar mais pousadas
            </Link>
          </div>
        </div>

        {favorites.length ? (
          <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {favorites.map((pousada) => (
              <article
                key={pousada.slug}
                className="group bg-card hover:shadow-floating flex h-full flex-col overflow-hidden rounded-3xl transition-[transform,box-shadow] duration-(--motion-fade) hover:-translate-y-1"
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
                    className="object-cover transition-transform duration-(--motion-reveal) group-hover:scale-105"
                  />
                  <Badge variant="glass" size="lg" className="absolute top-3 left-3 tabular-nums">
                    <Star className="fill-ipe text-ipe size-3.5" />
                    {pousada.rating.toFixed(1)}
                  </Badge>
                  <span className="glass-dark absolute top-3 right-3 flex size-10 items-center justify-center rounded-full border">
                    <Heart className="fill-ipe text-ipe size-4" />
                  </span>
                </Link>

                <div className="flex flex-1 flex-col p-5">
                  <div className="text-muted-foreground text-sm font-medium">
                    {pousada.city}, {pousada.state}
                  </div>
                  <h2 className="text-h3 text-foreground mt-1">{pousada.name}</h2>
                  <p className="text-muted-foreground mt-3 line-clamp-2 text-sm leading-relaxed">
                    {pousada.description}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {pousada.tags.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="secondary" size="md">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <div className="bg-secondary mt-5 rounded-2xl p-4">
                    <div className="flex items-start gap-3">
                      <span className="bg-card text-foreground flex size-9 shrink-0 items-center justify-center rounded-full">
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
                      <TrendingDown className="text-foreground size-3.5" />
                      Base pronta para e-mail, WhatsApp e notificações.
                    </div>
                  </div>
                  <div className="mt-auto flex items-end justify-between pt-5">
                    <div>
                      <span className="text-foreground text-lg font-semibold tabular-nums">
                        {formatPrice(pousada.pricePerNight)}
                      </span>
                      <span className="text-muted-foreground text-sm"> / diária</span>
                    </div>
                    <Link
                      href={`/pousada/${pousada.slug}`}
                      className={cn(
                        buttonVariants({ size: 'pill-sm' }),
                        'hover:bg-accent hover:text-accent-foreground',
                      )}
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
          <div className="bg-card mt-10 rounded-3xl p-10 text-center">
            <span className="bg-secondary text-foreground mx-auto flex size-12 items-center justify-center rounded-full">
              <Heart className="size-6" />
            </span>
            <h2 className="text-h2 text-foreground mt-5">Você ainda não salvou pousadas</h2>
            <p className="text-muted-foreground mx-auto mt-2 max-w-md text-base">
              Abra uma pousada e toque em Salvar. Ela aparece aqui para você comparar depois.
            </p>
            <Link href="/pousadas" className={cn(buttonVariants({ size: 'pill' }), 'mt-6')}>
              Ver pousadas
            </Link>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  )
}
