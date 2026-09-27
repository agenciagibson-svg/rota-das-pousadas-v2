'use client'

import {
  CalendarCheck,
  Clock3,
  Mail,
  MessageSquare,
  MessageSquareText,
  Send,
  Users,
} from 'lucide-react'
import { DashboardShell } from '@/components/dashboard/shell'
import { ownerDashboardNav } from '@/components/dashboard/owner-nav'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { buttonVariants } from '@/components/ui/button'
import { BOOKING_STATUS } from '@/features/reservas'
import type { OwnerPousadaSettings, OwnerReservation } from '../types'

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function messageSubject(reservation: OwnerReservation) {
  if (reservation.status === 'pending') return 'Pagamento pendente'
  if (reservation.status === 'confirmed') return 'Check-in próximo'
  if (reservation.status === 'checked_in') return 'Acompanhamento da estadia'
  if (reservation.status === 'checked_out') return 'Pedir avaliação'
  return 'Reserva'
}

function quickMessage(reservation: OwnerReservation, settings: OwnerPousadaSettings | null) {
  const checkin = settings?.checkinTime || '14:00'
  const checkout = settings?.checkoutTime || '12:00'

  if (reservation.status === 'pending') {
    return `Olá, ${reservation.guestName}! Sua reserva ${reservation.code} está aguardando pagamento. Ela fica disponível até o prazo informado no painel. Se precisar de ajuda para concluir, estou à disposição.`
  }

  if (reservation.status === 'confirmed') {
    return `Olá, ${reservation.guestName}! Sua reserva ${reservation.code} está confirmada. O check-in começa às ${checkin} e o check-out é até ${checkout}. Qual horário previsto para sua chegada?`
  }

  if (reservation.status === 'checked_out') {
    return `Olá, ${reservation.guestName}! Esperamos que tenha aproveitado a estadia. Sua avaliação ajuda muito nossa pousada e outros viajantes.`
  }

  return `Olá, ${reservation.guestName}! Estou entrando em contato sobre sua reserva ${reservation.code}, de ${fmtDate(reservation.checkin)} a ${fmtDate(reservation.checkout)}.`
}

/** O repositório usa um texto no lugar do e-mail vazio; só abre o mailto com endereço de verdade. */
function hasEmail(value: string | null | undefined): boolean {
  return !!value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export function OwnerMessagesView({
  displayName,
  pousadaName,
  reservations,
  settings,
}: {
  displayName: string
  pousadaName: string
  reservations: OwnerReservation[]
  settings: OwnerPousadaSettings | null
}) {
  const activeReservations = reservations.filter(
    (reservation) => !['cancelled', 'no_show'].includes(reservation.status),
  )
  const pendingPayments = reservations.filter((reservation) => reservation.status === 'pending')
  const confirmed = reservations.filter((reservation) => reservation.status === 'confirmed')

  return (
    <DashboardShell
      nav={ownerDashboardNav('mensagens')}
      brandLabel={pousadaName}
      brandSub="Painel do proprietário"
      title="Mensagens"
      subtitle="Converse com hóspedes e acompanhe solicitações."
      user={{ name: displayName, role: 'Proprietário' }}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <div className="text-muted-foreground text-sm">Conversas de reservas</div>
          <div className="text-foreground mt-2 text-3xl font-semibold">{reservations.length}</div>
        </Card>
        <Card className="p-5">
          <div className="text-muted-foreground text-sm">Pagamentos pendentes</div>
          <div className="text-foreground mt-2 text-3xl font-semibold">
            {pendingPayments.length}
          </div>
        </Card>
        <Card className="p-5">
          <div className="text-muted-foreground text-sm">Check-ins confirmados</div>
          <div className="text-foreground mt-2 text-3xl font-semibold">{confirmed.length}</div>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 2xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <span className="bg-primary/10 text-primary flex size-11 items-center justify-center rounded-2xl">
              <MessageSquare className="size-5" />
            </span>
            <div>
              <h2 className="text-foreground font-semibold">Caixa de entrada</h2>
              <p className="text-muted-foreground text-sm">Contatos organizados por reserva.</p>
            </div>
          </div>

          {reservations.length === 0 ? (
            <EmptyState
              className="mt-6"
              icon={MessageSquare}
              title="Nenhuma conversa ainda"
              description="Quando houver reservas, os contatos dos hóspedes aparecerão aqui."
            />
          ) : (
            <div className="mt-6 space-y-3">
              {reservations.map((reservation) => {
                const status = BOOKING_STATUS[reservation.status]
                return (
                  <div key={reservation.id} className="border-border rounded-2xl border p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-foreground font-serif text-lg font-semibold">
                            {reservation.guestName}
                          </h3>
                          <Badge variant={status.variant} size="sm">
                            {status.label}
                          </Badge>
                          <span className="bg-secondary text-muted-foreground rounded-full px-2.5 py-1 text-xs font-medium">
                            {messageSubject(reservation)}
                          </span>
                        </div>
                        <div className="text-muted-foreground mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                          <span className="inline-flex items-center gap-1.5">
                            <Mail className="size-3.5" />
                            {reservation.guestEmail}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <CalendarCheck className="size-3.5" />
                            {fmtDate(reservation.checkin)} - {fmtDate(reservation.checkout)}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <Users className="size-3.5" />
                            {reservation.guests} hóspede(s)
                          </span>
                          <span>{reservation.code}</span>
                        </div>
                      </div>

                      {hasEmail(reservation.guestEmail) ? (
                        <a
                          href={`mailto:${reservation.guestEmail}?subject=${encodeURIComponent(
                            `Reserva ${reservation.code} - ${pousadaName}`,
                          )}&body=${encodeURIComponent(quickMessage(reservation, settings))}`}
                          className={buttonVariants({ size: 'sm' })}
                        >
                          <Send className="size-3.5" />
                          Enviar e-mail
                        </a>
                      ) : (
                        <span className="text-muted-foreground text-xs">Sem e-mail cadastrado</span>
                      )}
                    </div>

                    <div className="bg-secondary text-foreground mt-4 rounded-2xl p-3 text-sm leading-relaxed">
                      {quickMessage(reservation, settings)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        <div className="space-y-5">
          <Card className="p-6">
            <div className="text-foreground flex items-center gap-2 font-semibold">
              <MessageSquareText className="text-primary size-4" />
              Respostas rápidas
            </div>
            <div className="mt-4 space-y-3">
              {[
                {
                  title: 'Check-in',
                  text: `O check-in começa às ${settings?.checkinTime || '14:00'}.`,
                },
                {
                  title: 'Check-out',
                  text: `O check-out é até ${settings?.checkoutTime || '12:00'}.`,
                },
                {
                  title: 'Regras da casa',
                  text: settings?.houseRules || 'As regras da casa ainda não foram cadastradas.',
                },
                {
                  title: 'Cancelamento',
                  text:
                    settings?.cancellationPolicy ||
                    'A política de cancelamento ainda não foi cadastrada.',
                },
              ].map((item) => (
                <div key={item.title} className="border-border rounded-2xl border p-3">
                  <div className="text-foreground text-sm font-semibold">{item.title}</div>
                  <p className="text-muted-foreground mt-1 text-sm">{item.text}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <div className="text-foreground flex items-center gap-2 font-semibold">
              <Clock3 className="text-primary size-4" />
              Prioridade
            </div>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              {pendingPayments.length > 0
                ? 'Comece pelos hóspedes com pagamento pendente para evitar expiração automática.'
                : activeReservations.length > 0
                  ? 'Mantenha contato com os próximos hóspedes antes do check-in.'
                  : 'Quando novas reservas chegarem, elas aparecerão aqui como conversas.'}
            </p>
          </Card>
        </div>
      </div>
    </DashboardShell>
  )
}
