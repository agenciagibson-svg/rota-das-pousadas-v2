import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { CalendarDays, ChevronRight, Link2, MapPin, MessageCircleMore } from 'lucide-react'
import { Logo, Marker } from '@/components/brand/logo'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { isReservedSlug } from '@/lib/slug'
import { publicEnv } from '@/lib/env'
import { QuoteCard } from '@/features/bio/components/quote-card'
import {
  getBioPousadaBySlug,
  listBookableRooms,
  recordLinkEvent,
} from '@/repositories/bio.repository'
import { formatBRL } from '@/lib/format'

/**
 * Página da bio — o link que a pousada põe no Instagram.
 *
 * MODELO A ("calendário primeiro"): nome, uma linha, e o seletor de datas
 * imediatamente. Quem clica no link da bio quase sempre já conhece a pousada e
 * só quer saber se tem vaga; foto e vídeo já vivem no próprio Instagram.
 *
 * SEM JAVASCRIPT NO CAMINHO PRINCIPAL: o seletor de datas é um `form method
 *="get"` e os resultados vêm renderizados do servidor. Esse link abre quase
 * sempre dentro do navegador interno do Instagram, em celular e rede ruim —
 * cada script a menos é conversão a mais. Só o card de orçamento é cliente.
 *
 * ROTA NA RAIZ: mora em `/<slug>` para caber na bio. Caminho estático sempre
 * vence sobre dinâmico no App Router, então um slug igual a um caminho do site
 * seria engolido em silêncio — por isso `isReservedSlug` (ver lib/slug.ts).
 */
export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ checkin?: string; checkout?: string; hospedes?: string }>
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function validDate(value: string | undefined): string | null {
  if (!value || !DATE_RE.test(value)) return null
  const parsed = new Date(`${value}T00:00:00Z`)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) return null
  return value
}

function fmt(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function nights(checkin: string, checkout: string): number {
  const a = new Date(`${checkin}T00:00:00Z`).getTime()
  const b = new Date(`${checkout}T00:00:00Z`).getTime()
  return Math.max(0, Math.round((b - a) / 86_400_000))
}

/** Campo do seletor de datas: mesma linguagem do `Input`, sem JavaScript. */
const fieldClass =
  'border-input bg-background text-foreground focus-visible:border-foreground focus-visible:ring-ipe/60 min-h-12 w-full rounded-2xl border px-3 text-sm outline-none focus-visible:ring-2'
const labelClass = 'text-foreground text-sm font-medium'

function BioHeader({ name, city, state }: { name: string; city: string; state: string }) {
  return (
    <header className="flex flex-col gap-2">
      <p className="text-muted-foreground inline-flex items-center gap-2 text-sm font-medium">
        <Marker /> {city}, {state}
      </p>
      <h1 className="text-h1 text-foreground text-balance">{name}</h1>
    </header>
  )
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  if (isReservedSlug(slug)) return { title: 'Página não encontrada' }
  const pousada = await getBioPousadaBySlug(slug)
  if (!pousada) return { title: 'Pousada não encontrada' }
  return {
    title: `${pousada.name} — reservas`,
    description:
      pousada.description.slice(0, 160) ||
      `Consulte disponibilidade e reserve direto na ${pousada.name}.`,
    alternates: { canonical: `${publicEnv.siteUrl}/${pousada.slug}` },
    openGraph: {
      title: `${pousada.name} — reservas`,
      description: `Consulte disponibilidade e reserve direto com a ${pousada.name}.`,
      images: pousada.image ? [pousada.image] : undefined,
    },
  }
}

export default async function BioPage({ params, searchParams }: PageProps) {
  const { slug } = await params
  if (isReservedSlug(slug)) notFound()

  const query = await searchParams
  const pousada = await getBioPousadaBySlug(slug)
  if (!pousada) notFound()

  const checkin = validDate(query.checkin)
  const checkoutRaw = validDate(query.checkout)
  const checkout = checkin && checkoutRaw && checkoutRaw > checkin ? checkoutRaw : null
  const hasDates = Boolean(checkin && checkout)
  const guests = Math.min(100, Math.max(1, Number(query.hospedes ?? 2) || 2))

  // --------------------------------------------------------------------------
  // Estado "em preparação": o link é entregue no cadastro, então ele existe
  // antes de a pousada terminar de se cadastrar — e ela cola na bio no mesmo
  // dia. A página nunca pode aparecer vazia ou quebrada para os seguidores.
  // --------------------------------------------------------------------------
  if (!pousada.published) {
    await recordLinkEvent({ pousadaId: pousada.id, event: 'view' })
    return (
      <main
        id="conteudo"
        tabIndex={-1}
        className="mx-auto flex min-h-screen max-w-md flex-col gap-5 px-5 py-8"
      >
        <BioHeader name={pousada.name} city={pousada.city} state={pousada.state} />
        <div className="border-ipe/50 bg-ipe/15 rounded-3xl border p-5">
          <h2 className="text-h3 text-foreground">Reservas em breve</h2>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Estamos finalizando o cadastro das acomodações. Enquanto isso, fale direto com a gente.
          </p>
        </div>
        <ContactLinks pousada={pousada} />
        <Footer />
      </main>
    )
  }

  const rooms = await listBookableRooms(slug, checkin, checkout, guests)

  await recordLinkEvent({ pousadaId: pousada.id, event: 'view' })
  if (hasDates) {
    await recordLinkEvent({
      pousadaId: pousada.id,
      event: 'search',
      checkin,
      checkout,
      guests,
      availableCount: rooms.length,
    })
  }

  const noites = hasDates ? nights(checkin as string, checkout as string) : 0

  return (
    <main
      id="conteudo"
      tabIndex={-1}
      className="mx-auto flex min-h-screen max-w-md flex-col gap-5 px-5 py-8"
    >
      <BioHeader name={pousada.name} city={pousada.city} state={pousada.state} />

      {/* Seletor de datas — form GET, sem JavaScript. */}
      <form
        action={`/${pousada.slug}`}
        method="get"
        className="bg-card shadow-card grid grid-cols-2 gap-3 rounded-3xl p-4"
      >
        <label className="flex min-w-0 flex-col gap-1.5">
          <span className={labelClass}>Entrada</span>
          <input
            type="date"
            name="checkin"
            id="bio-checkin"
            defaultValue={checkin ?? ''}
            className={fieldClass}
          />
        </label>
        <label className="flex min-w-0 flex-col gap-1.5">
          <span className={labelClass}>Saída</span>
          <input
            type="date"
            name="checkout"
            id="bio-checkout"
            defaultValue={checkout ?? ''}
            className={fieldClass}
          />
        </label>
        <div className="col-span-2 flex items-end gap-3">
          <label className="flex w-24 shrink-0 flex-col gap-1.5">
            <span className={labelClass}>Hósp.</span>
            <input
              type="number"
              name="hospedes"
              id="bio-hospedes"
              min={1}
              max={100}
              defaultValue={guests}
              className={cn(fieldClass, 'tabular-nums')}
            />
          </label>
          <button
            type="submit"
            className={cn(buttonVariants({ variant: 'accent', size: 'pill' }), 'flex-1')}
          >
            Ver disponibilidade
          </button>
        </div>
      </form>

      {hasDates && (
        <p className="text-muted-foreground text-sm tabular-nums">
          {fmt(checkin as string)} a {fmt(checkout as string)} · {noites}{' '}
          {noites === 1 ? 'noite' : 'noites'} · {guests} {guests === 1 ? 'hóspede' : 'hóspedes'}
        </p>
      )}

      {rooms.length > 0 ? (
        <section className="flex flex-col gap-2.5">
          {rooms.map((room) => {
            const total = hasDates ? (room.stayTotal ?? room.basePrice * noites) : room.basePrice
            const belowMinimum = hasDates && noites < room.minNights
            return (
              <Link
                key={room.id}
                href={
                  hasDates
                    ? `/pousada/${pousada.slug}/reservar?checkin=${checkin}&checkout=${checkout}&guests=${guests}&quarto=${room.id}&origem=link_bio`
                    : `/pousada/${pousada.slug}?origem=link_bio`
                }
                className="group bg-card hover:shadow-floating flex min-h-16 items-center justify-between gap-3 rounded-2xl p-3 transition-shadow duration-(--motion-hover)"
              >
                <span className="flex min-w-0 items-center gap-3">
                  {room.gallery[0] && (
                    <span className="relative size-16 shrink-0 overflow-hidden rounded-xl">
                      <Image
                        src={room.gallery[0]}
                        alt={room.name}
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="text-foreground block text-base font-semibold">
                      {room.name}
                    </span>
                    <span className="text-muted-foreground block text-sm">
                      até {room.capacity} {room.capacity === 1 ? 'hóspede' : 'hóspedes'}
                    </span>
                    {belowMinimum && (
                      <span className="text-foreground block text-xs font-medium">
                        Mínimo de {room.minNights} noites nessas datas
                      </span>
                    )}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="text-right">
                    <span className="text-foreground block text-base font-semibold tabular-nums">
                      {formatBRL(total)}
                    </span>
                    <span className="text-muted-foreground block text-xs">
                      {hasDates ? `${noites} ${noites === 1 ? 'noite' : 'noites'}` : 'por noite'}
                    </span>
                  </span>
                  <ChevronRight className="text-muted-foreground group-hover:text-foreground size-4 transition-colors" />
                </span>
              </Link>
            )
          })}
        </section>
      ) : (
        <Card radius="3xl" border={false} className="p-5">
          <span className="bg-secondary text-foreground flex size-10 items-center justify-center rounded-full">
            <CalendarDays className="size-5" />
          </span>
          <h2 className="text-h3 text-foreground mt-3">
            {hasDates ? 'Sem vaga nessas datas' : 'Acomodações em atualização'}
          </h2>
          <p className="text-muted-foreground mt-1.5 text-sm">
            {hasDates
              ? 'Tente outro período — ou peça um orçamento e a pousada avisa se abrir vaga.'
              : 'Peça um orçamento e a pousada responde com as opções disponíveis.'}
          </p>
        </Card>
      )}

      <QuoteCard
        pousadaId={pousada.id}
        whatsapp={pousada.whatsapp || null}
        defaults={{ checkin: checkin ?? '', checkout: checkout ?? '', adults: guests }}
      />

      <ContactLinks pousada={pousada} />
      <Footer />
    </main>
  )
}

const contactClass =
  'bg-card text-foreground hover:bg-secondary flex min-h-12 items-center justify-between rounded-2xl px-4 text-sm font-medium transition-colors duration-(--motion-hover)'

function ContactLinks({
  pousada,
}: {
  pousada: { whatsapp: string; instagram: string; city: string; state: string; name: string }
}) {
  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${pousada.name} ${pousada.city} ${pousada.state}`,
  )}`
  return (
    <nav aria-label="Contato" className="flex flex-col gap-2">
      {pousada.whatsapp && (
        <a
          href={`https://wa.me/${pousada.whatsapp.replace(/\D/g, '')}`}
          target="_blank"
          rel="noopener noreferrer"
          className={contactClass}
        >
          <span className="inline-flex items-center gap-2">
            <MessageCircleMore className="size-4" /> WhatsApp
          </span>
          <ChevronRight className="text-muted-foreground size-4" />
        </a>
      )}
      {pousada.instagram && (
        <a
          href={`https://instagram.com/${pousada.instagram.replace(/^@/, '')}`}
          target="_blank"
          rel="noopener noreferrer"
          className={contactClass}
        >
          <span className="inline-flex items-center gap-2">
            <Link2 className="size-4" /> Instagram
          </span>
          <ChevronRight className="text-muted-foreground size-4" />
        </a>
      )}
      <a href={maps} target="_blank" rel="noopener noreferrer" className={contactClass}>
        <span className="inline-flex items-center gap-2">
          <MapPin className="size-4" /> Como chegar
        </span>
        <ChevronRight className="text-muted-foreground size-4" />
      </a>
    </nav>
  )
}

function Footer() {
  return (
    <footer className="text-muted-foreground mt-auto flex items-center justify-center gap-2 pt-6 text-xs">
      Reservas por{' '}
      <Link href="/" className="text-foreground inline-flex py-2">
        <Logo className="h-3.5" />
      </Link>
    </footer>
  )
}
