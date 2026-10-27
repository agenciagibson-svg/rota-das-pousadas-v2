import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CalendarCheck, CalendarX2, Clock3, MapPin, Navigation, ReceiptText } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { Container } from '@/components/ui/container'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { buttonVariants } from '@/components/ui/button'
import { getSharedTrip } from '@/server/queries'
import { tripMapsUrl, type SharedTripDetails } from '@/features/reservas/share'
import { bookingLocation } from '@/features/reservas/ics'
import { formatISODate } from '@/lib/format'

export const dynamic = 'force-dynamic'

// Link privado: fora de busca e sem mandar o endereço (com o token) adiante.
export const metadata: Metadata = {
  title: 'Reserva compartilhada',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
}

const STATUS: Record<
  SharedTripDetails['status'],
  { label: string; variant: 'primarySoft' | 'goldSoft' | 'secondary' }
> = {
  confirmed: { label: 'Reserva confirmada', variant: 'primarySoft' },
  pending: { label: 'Aguardando confirmação da pousada', variant: 'goldSoft' },
  finished: { label: 'Estadia concluída', variant: 'secondary' },
}

const WEEKDAY = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: 'UTC' })

function weekday(iso: string): string {
  return WEEKDAY.format(new Date(`${iso}T00:00:00Z`))
}

/**
 * "Enviar para quem vai comigo" (h9, 0094): página pública, só leitura, para o
 * acompanhante. Mostra pousada, como chegar, datas, horários e código — nada
 * de valores, documento, contato ou outros hóspedes (o corte é do banco).
 */
export default async function SharedTripPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const trip = await getSharedTrip(token)
  if (!trip) notFound()

  if (trip.status === 'cancelled') {
    return (
      <Shell>
        <EmptyState
          size="lg"
          as="h1"
          icon={CalendarX2}
          title="Esta reserva foi cancelada"
          description="Fale com quem enviou o link para saber dos novos planos."
        />
      </Shell>
    )
  }

  const status = STATUS[trip.status]
  const location = bookingLocation(trip)

  return (
    <Shell>
      <p className="text-muted-foreground text-sm font-medium">Reserva compartilhada com você</p>
      <h1 className="text-h1 text-foreground mt-1 text-balance">{trip.pousadaName}</h1>
      <Badge variant={status.variant} className="mt-3">
        {status.label}
      </Badge>

      <Card radius="3xl" border={false} className="shadow-floating mt-6 p-6 lg:p-8">
        <dl className="grid gap-5 sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground flex items-center gap-1.5 text-sm">
              <CalendarCheck className="size-4" />
              Entrada
            </dt>
            <dd className="text-foreground mt-1 text-base font-semibold">
              {formatISODate(trip.checkin)}
              <span className="text-muted-foreground block text-sm font-normal">
                {weekday(trip.checkin)}
                {trip.checkinTime && `, a partir das ${trip.checkinTime}`}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground flex items-center gap-1.5 text-sm">
              <Clock3 className="size-4" />
              Saída
            </dt>
            <dd className="text-foreground mt-1 text-base font-semibold">
              {formatISODate(trip.checkout)}
              <span className="text-muted-foreground block text-sm font-normal">
                {weekday(trip.checkout)}
                {trip.checkoutTime && `, até as ${trip.checkoutTime}`}
              </span>
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground flex items-center gap-1.5 text-sm">
              <MapPin className="size-4" />
              Endereço
            </dt>
            <dd className="text-foreground mt-1 text-base">
              {location || 'Endereço não informado'}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground flex items-center gap-1.5 text-sm">
              <ReceiptText className="size-4" />
              Código da reserva
            </dt>
            <dd className="text-foreground mt-1 text-xl font-semibold tracking-wide tabular-nums">
              {trip.code}
            </dd>
            <dd className="text-muted-foreground mt-1 text-sm">
              Informe este código na recepção, se pedirem.
            </dd>
          </div>
        </dl>

        <a
          href={tripMapsUrl(trip)}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: 'accent', size: 'pill', className: 'mt-6 w-full' })}
        >
          <Navigation className="size-4" />
          Como chegar
        </a>
      </Card>

      <p className="text-muted-foreground mt-6 text-center text-sm">
        Este link foi enviado por quem fez a reserva e mostra só o necessário para a viagem.
      </p>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background min-h-screen">
      <SiteHeader forceSolid />
      <main id="conteudo" tabIndex={-1} className="pt-28 pb-24">
        <Container className="max-w-2xl">{children}</Container>
      </main>
      <SiteFooter />
    </div>
  )
}
