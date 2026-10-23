import { AtSign, MapPin, Star } from 'lucide-react'
import type { Pousada } from '@/types'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import { Gallery } from '@/components/ui/gallery'
import { cn } from '@/lib/utils'
import { FavoriteButton } from './favorite-button'
import { PousadaBooking, type BookableRoomInfo } from './pousada-booking'
import {
  AboutSection,
  hasImportantInfo,
  InfoSection,
  LocationSection,
  ReviewsSection,
  RoomsSection,
  sectionIds,
  type PublicReview,
  type PublicRoomInfo,
} from './pousada-sections'
import { ShareButton } from './share-button'

export type { BookableRoomInfo, PublicRoomInfo }

/**
 * Página da pousada: a foto é a protagonista (faixa que desliza no celular,
 * mosaico no desktop), o conteúdo entra numa folha clara por cima dela e o
 * caminho até "Reservar agora" fica sempre à mão — card fixo ao lado no
 * desktop, barra presa ao pé da tela no celular.
 */
export function PousadaDetail({
  pousada,
  room,
  rooms,
  stayNights = 0,
  reviews,
  initialBooking,
  favorite,
  isLoggedIn,
  bookingOrigin,
}: {
  pousada: Pousada
  room: BookableRoomInfo | null
  /** Todas as acomodações publicadas (com datas: as que têm vaga). */
  rooms: PublicRoomInfo[]
  /** Noites das datas da URL (0 sem datas). */
  stayNights?: number
  reviews: PublicReview[]
  initialBooking?: { checkin?: string; checkout?: string; guests?: string }
  favorite: boolean
  isLoggedIn: boolean
  /** `link_bio` quando a visita veio do link da bio — segue para a página de reserva. */
  bookingOrigin?: 'link_bio'
}) {
  const photos = pousada.gallery.length ? pousada.gallery : [pousada.image || '/placeholder.svg']
  const images = photos.map((src, i) => ({ src, alt: `${pousada.name} - foto ${i + 1}` }))
  const showInfo = hasImportantInfo(pousada)
  const tabs = [
    { id: sectionIds.sobre, label: 'Sobre o refúgio' },
    { id: sectionIds.quartos, label: 'Quartos & acomodações' },
    ...(showInfo ? [{ id: sectionIds.informacoes, label: 'Informações importantes' }] : []),
    { id: sectionIds.avaliacoes, label: 'Avaliações' },
    { id: sectionIds.localizacao, label: 'Localização' },
  ]

  return (
    <div className="pb-28 lg:pb-16">
      <div className="relative md:mx-auto md:max-w-7xl md:px-5 md:pt-28 lg:px-8">
        <Gallery layout="hero" images={images} priority />
        <div className="absolute top-24 right-4 z-10 flex gap-2 md:hidden">
          <ShareButton name={pousada.name} variant="glass" />
          <FavoriteButton
            slug={pousada.slug}
            initialFavorite={favorite}
            isLoggedIn={isLoggedIn}
            variant="glass"
          />
        </div>
      </div>

      <div className="bg-background relative z-10 -mt-6 rounded-t-3xl md:mt-0 md:rounded-none">
        <Container className="pt-6 md:pt-8">
          <header className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div className="min-w-0">
              <div className="flex flex-wrap gap-2">
                {pousada.tags.map((t) => (
                  <Badge key={t} variant="outline" size="lg" className="bg-card border-transparent">
                    {t}
                  </Badge>
                ))}
              </div>
              <h1 className="text-display-l text-foreground mt-4">{pousada.name}</h1>
              <div className="text-muted-foreground mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-base">
                <span className="text-foreground inline-flex items-center gap-1.5 font-semibold tabular-nums">
                  <Star className="fill-ipe text-ipe size-4" />
                  {pousada.rating.toFixed(1)}
                  <span className="text-muted-foreground font-normal">
                    ({pousada.reviews} avaliações)
                  </span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-4" />
                  {pousada.city}, {pousada.state}
                </span>
                {pousada.instagram && (
                  <a
                    href={pousada.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground inline-flex items-center gap-1.5 font-semibold underline-offset-4 hover:underline"
                  >
                    <AtSign className="size-4" />
                    Instagram
                  </a>
                )}
              </div>
            </div>
            <div className="hidden shrink-0 gap-2 md:flex">
              <ShareButton name={pousada.name} />
              <FavoriteButton
                slug={pousada.slug}
                initialFavorite={favorite}
                isLoggedIn={isLoggedIn}
              />
            </div>
          </header>

          {/* Abas em pílula: atalhos para as seções, presas abaixo do cabeçalho. */}
          <nav
            aria-label="Seções da pousada"
            className="bg-background/90 sticky top-[5.25rem] z-20 -mx-5 mt-6 flex [scrollbar-width:none] gap-2 overflow-x-auto px-5 py-3 backdrop-blur-md lg:top-[5.75rem] lg:mx-0 lg:px-0"
          >
            {tabs.map((tab) => (
              <a
                key={tab.id}
                href={`#${tab.id}`}
                className={cn(
                  buttonVariants({ variant: 'outline', size: 'pill-sm' }),
                  'bg-card shrink-0',
                )}
              >
                {tab.label}
              </a>
            ))}
          </nav>

          <div className="grid gap-x-12 lg:grid-cols-[minmax(0,1fr)_24rem]">
            <div className="lg:col-start-1">
              <AboutSection pousada={pousada} />
            </div>
            <div className="lg:col-start-1">
              <RoomsSection rooms={rooms} nights={stayNights} />
            </div>
            <aside className="py-4 lg:col-start-2 lg:row-span-6 lg:row-start-1 lg:py-10">
              <div className="lg:sticky lg:top-40">
                <PousadaBooking
                  slug={pousada.slug}
                  rating={pousada.rating}
                  room={room}
                  initialBooking={initialBooking}
                  bookingOrigin={bookingOrigin}
                />
              </div>
            </aside>
            {showInfo && (
              <div className="lg:col-start-1">
                <InfoSection pousada={pousada} />
              </div>
            )}
            <div className="lg:col-start-1">
              <ReviewsSection pousada={pousada} reviews={reviews} />
            </div>
            <div className="lg:col-start-1">
              <LocationSection pousada={pousada} />
            </div>
          </div>
        </Container>
      </div>
    </div>
  )
}
