import type { ReactNode } from 'react'
import {
  ClipboardList,
  Clock3,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  Quote,
  ShieldCheck,
  Star,
} from 'lucide-react'
import type { Pousada } from '@/types'
import { Reveal } from '@/components/reveal'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatBRL } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Gallery } from '@/components/ui/gallery'

/** Avaliação pública (sem nome do autor — ver `reviews.repository.ts::listPublicReviewsByPousada`). */
export type PublicReview = {
  id: string
  rating: number
  text: string
  response: string | null
  createdAt: string
}

/** Âncoras das seções, na ordem das abas em pílula. */
export const sectionIds = {
  sobre: 'sobre',
  quartos: 'quartos',
  informacoes: 'informacoes',
  avaliacoes: 'avaliacoes',
  localizacao: 'localizacao',
} as const

function formatReviewDate(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(iso))
}

/** Dígitos puros de um telefone BR ("(34) 99999-0000" -> "34999990000"). */
function onlyDigits(value: string): string {
  return value.replace(/\D/g, '')
}

function Block({
  id,
  title,
  children,
  className,
}: {
  id: string
  title: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section id={id} className={cn('border-border scroll-mt-40 border-t py-10', className)}>
      <Reveal>
        <h2 className="text-h2 text-foreground">{title}</h2>
        <div className="mt-6">{children}</div>
      </Reveal>
    </section>
  )
}

function InfoItem({
  icon,
  title,
  children,
}: {
  icon: ReactNode
  title: string
  children: ReactNode
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="bg-secondary text-foreground flex size-10 shrink-0 items-center justify-center rounded-full">
        {icon}
      </span>
      <div className="text-base">
        <div className="text-foreground font-semibold">{title}</div>
        <div className="text-muted-foreground mt-1 text-pretty break-words">{children}</div>
      </div>
    </div>
  )
}

export function AboutSection({ pousada }: { pousada: Pousada }) {
  return (
    <Block id={sectionIds.sobre} title="Sobre o refúgio" className="border-t-0 pt-6">
      <p className="text-body-l text-muted-foreground text-pretty">{pousada.description}</p>
    </Block>
  )
}

/** Acomodação na vitrine (fotos e, com datas, o total da estadia). */
export type PublicRoomInfo = {
  id: string
  name: string
  description: string
  capacity: number
  nightly: number
  gallery: string[]
  stayTotal: number | null
  minNights: number
}

export function RoomsSection({
  rooms,
  nights,
}: {
  rooms: PublicRoomInfo[]
  /** Noites das datas escolhidas (0 sem datas). */
  nights: number
}) {
  return (
    <Block id={sectionIds.quartos} title="Quartos & acomodações">
      {rooms.length > 0 ? (
        <div className="space-y-4">
          {rooms.map((room) => (
            <Card key={room.id} radius="3xl" border={false} className="overflow-hidden">
              {room.gallery.length > 0 && (
                <Gallery
                  images={room.gallery.map((src, i) => ({
                    src,
                    alt: `${room.name}, foto ${i + 1}`,
                  }))}
                />
              )}
              <div className="flex items-start justify-between gap-4 p-5">
                <div className="min-w-0">
                  <h3 className="text-foreground text-lg font-semibold">{room.name}</h3>
                  {room.description && (
                    <p className="text-muted-foreground mt-1 text-base">{room.description}</p>
                  )}
                  <p className="text-muted-foreground mt-1 text-sm">
                    até {room.capacity} {room.capacity === 1 ? 'hóspede' : 'hóspedes'}
                  </p>
                  {nights > 0 && nights < room.minNights && (
                    <p className="text-foreground mt-1 text-sm font-medium">
                      Mínimo de {room.minNights} noites nessas datas
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right tabular-nums">
                  {nights > 0 && room.stayTotal !== null ? (
                    <>
                      <div className="text-foreground text-lg font-semibold">
                        {formatBRL(room.stayTotal)}
                      </div>
                      <div className="text-muted-foreground text-sm">
                        {nights} {nights === 1 ? 'noite' : 'noites'}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-foreground text-lg font-semibold">
                        {formatBRL(room.nightly)}
                      </div>
                      <div className="text-muted-foreground text-sm">/ diária</div>
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-base">
          {nights > 0
            ? 'Nenhuma acomodação com vaga nessas datas. Tente outro período.'
            : 'Nenhuma acomodação disponível no momento.'}
        </p>
      )}
    </Block>
  )
}

export function hasImportantInfo(pousada: Pousada): boolean {
  return Boolean(
    pousada.checkinTime ||
    pousada.checkoutTime ||
    pousada.houseRules ||
    pousada.cancellationPolicy ||
    pousada.whatsapp ||
    pousada.contactPhone,
  )
}

export function InfoSection({ pousada }: { pousada: Pousada }) {
  const whatsappDigits = pousada.whatsapp ? onlyDigits(pousada.whatsapp) : ''
  const phoneDigits = pousada.contactPhone ? onlyDigits(pousada.contactPhone) : ''
  const contactLink = cn(buttonVariants({ variant: 'outline', size: 'pill-sm' }), 'bg-card')

  return (
    <Block id={sectionIds.informacoes} title="Informações importantes">
      <div className="grid gap-6 sm:grid-cols-2">
        {(pousada.checkinTime || pousada.checkoutTime) && (
          <InfoItem icon={<Clock3 className="size-5" />} title="Check-in e check-out">
            Check-in a partir das {pousada.checkinTime || '—'} · check-out até{' '}
            {pousada.checkoutTime || '—'}
          </InfoItem>
        )}
        {pousada.cancellationPolicy && (
          <InfoItem icon={<ShieldCheck className="size-5" />} title="Política de cancelamento">
            {pousada.cancellationPolicy}
          </InfoItem>
        )}
        {pousada.houseRules && (
          <InfoItem icon={<ClipboardList className="size-5" />} title="Regras da casa">
            {pousada.houseRules}
          </InfoItem>
        )}
        {(whatsappDigits || phoneDigits) && (
          <InfoItem icon={<Phone className="size-5" />} title="Fale com a pousada">
            <span className="mt-1 flex flex-wrap gap-2">
              {whatsappDigits && (
                <a
                  href={`https://wa.me/55${whatsappDigits}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={contactLink}
                >
                  <MessageCircle className="size-4" />
                  WhatsApp
                </a>
              )}
              {phoneDigits && (
                <a href={`tel:+55${phoneDigits}`} className={contactLink}>
                  <Phone className="size-4" />
                  {pousada.contactPhone}
                </a>
              )}
            </span>
          </InfoItem>
        )}
      </div>
    </Block>
  )
}

export function ReviewsSection({
  pousada,
  reviews,
}: {
  pousada: Pousada
  reviews: PublicReview[]
}) {
  return (
    <Block
      id={sectionIds.avaliacoes}
      title={
        <span className="flex items-center gap-3">
          Avaliações
          <span className="bg-card text-foreground inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-sans text-sm font-semibold tabular-nums">
            <Star className="fill-ipe text-ipe size-4" />
            {pousada.rating.toFixed(1)}
          </span>
        </span>
      }
    >
      {reviews.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {reviews.map((r) => (
            <li key={r.id}>
              <Card radius="3xl" border={false} className="flex h-full flex-col p-5">
                <Quote className="text-pedra size-6" />
                <p className="text-foreground mt-3 flex-1 text-base leading-relaxed break-words">
                  {r.text}
                </p>
                <div
                  role="img"
                  className="mt-4 flex items-center gap-1"
                  aria-label={`${r.rating} de 5`}
                >
                  {Array.from({ length: r.rating }).map((_, i) => (
                    <Star key={i} className="fill-ipe text-ipe size-3.5" />
                  ))}
                </div>
                <div className="text-muted-foreground mt-2 text-sm">
                  {formatReviewDate(r.createdAt)}
                </div>
                {r.response && (
                  <div className="bg-secondary text-muted-foreground mt-3 rounded-2xl p-3 text-sm break-words">
                    <span className="text-foreground font-semibold">Resposta da pousada: </span>
                    {r.response}
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-base">
          Ainda sem avaliações públicas por aqui — as primeiras aparecem depois que um hóspede
          avalia a estadia.
        </p>
      )}
    </Block>
  )
}

export function LocationSection({ pousada }: { pousada: Pousada }) {
  const mapsUrl = pousada.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${pousada.address}, ${pousada.city} - ${pousada.state}`)}`
    : null
  return (
    <Block id={sectionIds.localizacao} title="Localização">
      <Card
        radius="3xl"
        border={false}
        className="flex flex-col items-start justify-between gap-4 p-5 sm:flex-row sm:items-center"
      >
        <div className="flex items-start gap-3 text-base">
          <MapPin className="text-foreground mt-0.5 size-5 shrink-0" />
          <div>
            <div className="text-foreground font-semibold">
              {pousada.city}, {pousada.state}
            </div>
            {pousada.address && (
              <div className="text-muted-foreground mt-0.5">{pousada.address}</div>
            )}
          </div>
        </div>
        {mapsUrl && (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: 'outline', size: 'pill' }), 'shrink-0')}
          >
            <Navigation className="size-4" />
            Ver no mapa
          </a>
        )}
      </Card>
    </Block>
  )
}
