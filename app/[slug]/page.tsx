import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CalendarDays, Link2, MapPin, MessageCircleMore } from 'lucide-react'
import { isReservedSlug } from '@/lib/slug'
import { publicEnv } from '@/lib/env'
import { QuoteCard } from '@/features/bio/components/quote-card'
import {
  getBioPousadaBySlug,
  listBookableRooms,
  recordLinkEvent,
} from '@/repositories/bio.repository'

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

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  if (isReservedSlug(slug)) return { title: 'Página não encontrada' }
  const pousada = await getBioPousadaBySlug(slug)
  if (!pousada) return { title: 'Pousada não encontrada' }
  return {
    title: `${pousada.name} — reservas`,
    description: pousada.description.slice(0, 160) || `Consulte disponibilidade e reserve direto na ${pousada.name}.`,
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
      <main className="mx-auto flex min-h-screen max-w-md flex-col gap-5 px-5 py-10">
        <header className="flex flex-col gap-1.5">
          <h1 className="font-serif text-2xl font-semibold leading-tight text-foreground">{pousada.name}</h1>
          <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="size-3.5" /> {pousada.city}, {pousada.state}
          </p>
        </header>
        <div className="rounded-2xl border border-gold/40 bg-gold/10 p-5">
          <h2 className="font-serif text-lg font-semibold text-foreground">Reservas em breve</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
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
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-5 px-5 py-10">
      <header className="flex flex-col gap-1.5">
        <h1 className="font-serif text-2xl font-semibold leading-tight text-foreground">{pousada.name}</h1>
        <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="size-3.5" /> {pousada.city}, {pousada.state}
        </p>
      </header>

      {/* Seletor de datas — form GET, sem JavaScript. */}
      <form
        action={`/${pousada.slug}`}
        method="get"
        className="flex flex-col gap-3 rounded-2xl border border-primary/40 bg-secondary/40 p-4"
      >
        <div className="flex gap-2">
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Entrada</span>
            <input
              type="date"
              name="checkin"
              id="bio-checkin"
              defaultValue={checkin ?? ''}
              className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm text-foreground outline-none focus-visible:border-ring"
            />
          </label>
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Saída</span>
            <input
              type="date"
              name="checkout"
              id="bio-checkout"
              defaultValue={checkout ?? ''}
              className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm text-foreground outline-none focus-visible:border-ring"
            />
          </label>
          <label className="flex w-20 flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Hósp.</span>
            <input
              type="number"
              name="hospedes"
              id="bio-hospedes"
              min={1}
              max={100}
              defaultValue={guests}
              className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm text-foreground outline-none focus-visible:border-ring"
            />
          </label>
        </div>
        <button
          type="submit"
          className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:brightness-105"
        >
          Ver disponibilidade
        </button>
      </form>

      {hasDates && (
        <p className="text-sm text-muted-foreground">
          {fmt(checkin as string)} a {fmt(checkout as string)} · {noites}{' '}
          {noites === 1 ? 'noite' : 'noites'} · {guests} {guests === 1 ? 'hóspede' : 'hóspedes'}
        </p>
      )}

      {rooms.length > 0 ? (
        <section className="flex flex-col gap-2.5">
          {rooms.map((room) => (
            <Link
              key={room.id}
              href={
                hasDates
                  ? `/pousada/${pousada.slug}/reservar?checkin=${checkin}&checkout=${checkout}&guests=${guests}&origem=link_bio`
                  : `/pousada/${pousada.slug}?origem=link_bio`
              }
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3.5 transition-colors hover:border-primary/50"
            >
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground">{room.name}</span>
                <span className="block text-xs text-muted-foreground">
                  até {room.capacity} {room.capacity === 1 ? 'hóspede' : 'hóspedes'}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-sm font-semibold tabular-nums text-foreground">
                  R$ {hasDates ? room.basePrice * noites : room.basePrice}
                </span>
                <span className="block text-[11px] text-muted-foreground">
                  {hasDates ? `${noites} ${noites === 1 ? 'noite' : 'noites'}` : 'por noite'}
                </span>
              </span>
            </Link>
          ))}
        </section>
      ) : (
        <div className="rounded-2xl border border-border bg-secondary/40 p-5">
          <CalendarDays className="size-5 text-muted-foreground" />
          <h2 className="mt-2 font-serif text-lg font-semibold text-foreground">
            {hasDates ? 'Sem vaga nessas datas' : 'Acomodações em atualização'}
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {hasDates
              ? 'Tente outro período — ou peça um orçamento e a pousada avisa se abrir vaga.'
              : 'Peça um orçamento e a pousada responde com as opções disponíveis.'}
          </p>
        </div>
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

function ContactLinks({
  pousada,
}: {
  pousada: { whatsapp: string; instagram: string; city: string; state: string; name: string }
}) {
  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${pousada.name} ${pousada.city} ${pousada.state}`,
  )}`
  return (
    <nav className="flex flex-col gap-2">
      {pousada.whatsapp && (
        <a
          href={`https://wa.me/${pousada.whatsapp.replace(/\D/g, '')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
        >
          <span className="inline-flex items-center gap-2">
            <MessageCircleMore className="size-4" /> WhatsApp
          </span>
          <span className="text-muted-foreground">›</span>
        </a>
      )}
      {pousada.instagram && (
        <a
          href={`https://instagram.com/${pousada.instagram.replace(/^@/, '')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
        >
          <span className="inline-flex items-center gap-2">
            <Link2 className="size-4" /> Instagram
          </span>
          <span className="text-muted-foreground">›</span>
        </a>
      )}
      <a
        href={maps}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
      >
        <span className="inline-flex items-center gap-2">
          <MapPin className="size-4" /> Como chegar
        </span>
        <span className="text-muted-foreground">›</span>
      </a>
    </nav>
  )
}

function Footer() {
  return (
    <footer className="mt-auto pt-4 text-center text-xs text-muted-foreground">
      Reservas por{' '}
      <Link href="/" className="font-semibold text-foreground hover:underline">
        Rota das Pousadas
      </Link>
    </footer>
  )
}
