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
  const pendingPayments = reservations.filter(
    (reservation) => reservation.status === 'pending',
  )
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
          <div className="text-sm text-muted-foreground">Conversas de reservas</div>
          <div className="mt-2 text-3xl font-semibold text-foreground">{reservations.length}</div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-muted-foreground">Pagamentos pendentes</div>
          <div className="mt-2 text-3xl font-semibold text-foreground">{pendingPayments.length}</div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-muted-foreground">Check-ins confirmados</div>
          <div className="mt-2 text-3xl font-semibold text-foreground">{confirmed.length}</div>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 2xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <MessageSquare className="size-5" />
            </span>
            <div>
              <h2 className="font-semibold text-foreground">Caixa de entrada</h2>
              <p className="text-sm text-muted-foreground">
                Contatos organizados por reserva.
              </p>
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
                  <div key={reservation.id} className="rounded-2xl border border-border p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-serif text-lg font-semibold text-foreground">
                            {reservation.guestName}
                          </h3>
                          <Badge variant={status.variant} size="sm">
                            {status.label}
                          </Badge>
                          <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
                            {messageSubject(reservation)}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
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

                      <a
                        href={`mailto:${reservation.guestEmail}?subject=${encodeURIComponent(
                          `Reserva ${reservation.code} - ${pousadaName}`,
                        )}&body=${encodeURIComponent(quickMessage(reservation, settings))}`}
                        className={buttonVariants({ size: 'sm' })}
                      >
                        <Send className="size-3.5" />
                        Enviar e-mail
                      </a>
                    </div>

                    <div className="mt-4 rounded-2xl bg-secondary p-3 text-sm leading-relaxed text-foreground">
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
            <div className="flex items-center gap-2 font-semibold text-foreground">
              <MessageSquareText className="size-4 text-primary" />
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
                <div key={item.title} className="rounded-2xl border border-border p-3">
                  <div className="text-sm font-semibold text-foreground">{item.title}</div>
                  <p className="mt-1 text-sm text-muted-foreground">{item.text}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-2 font-semibold text-foreground">
              <Clock3 className="size-4 text-primary" />
              Prioridade
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
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
