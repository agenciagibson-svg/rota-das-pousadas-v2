import Link from 'next/link'
import { OwnerDashboardShell } from '@/components/dashboard/owner-shell'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { CalendarCheck } from 'lucide-react'
import { BOOKING_STATUS } from '@/features/reservas'
import type { BookingStatus } from '@/features/reservas'
import { GuestEditForm } from './guest-edit-form'
import type { GuestDetail } from '../types'
import { formatBRL, formatISODate } from '@/lib/format'

export function GuestProfileView({
  displayName,
  pousadaName,
  guest,
}: {
  displayName: string
  pousadaName: string
  guest: GuestDetail
}) {
  return (
    <OwnerDashboardShell
      section="hospedes"
      brandLabel={pousadaName}
      brandSub="Painel do proprietário"
      title={guest.preferredName || guest.fullName}
      subtitle="Perfil do hóspede"
      user={{ name: displayName, role: 'Proprietário' }}
    >
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card className="p-6">
          <h2 className="text-foreground font-semibold">Dados do hóspede</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Cadastro interno desta pousada — não visível para outras pousadas.
          </p>
          <div className="mt-5">
            <GuestEditForm guest={guest} />
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-foreground font-semibold">Histórico de reservas</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {guest.bookings.length === 1 ? '1 reserva' : `${guest.bookings.length} reservas`} nesta
            pousada.
          </p>
          <div className="mt-4">
            {guest.bookings.length === 0 ? (
              <EmptyState
                icon={CalendarCheck}
                title="Nenhuma reserva ainda"
                description="Este hóspede ainda não tem reservas."
              />
            ) : (
              // Lista em vez de tabela: a coluna é estreita e a tabela quebrava
              // o código e o valor em duas linhas.
              <ul className="divide-border divide-y">
                {guest.bookings.map((b) => {
                  const status = BOOKING_STATUS[b.status as BookingStatus]
                  return (
                    <li key={b.id} className="flex items-start justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/dashboard/reservas/${b.id}`}
                            className="text-primary font-semibold whitespace-nowrap hover:underline"
                          >
                            {b.code}
                          </Link>
                          {status ? (
                            <Badge variant={status.variant} size="sm">
                              {status.label}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">{b.status}</span>
                          )}
                        </div>
                        <p className="text-muted-foreground mt-1 text-sm">
                          <span className="whitespace-nowrap">
                            {formatISODate(b.checkin)} → {formatISODate(b.checkout)}
                          </span>
                          <span className="block truncate text-xs">{b.roomName}</span>
                        </p>
                      </div>
                      <span className="text-foreground shrink-0 text-sm font-semibold whitespace-nowrap">
                        {formatBRL(b.total)}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </Card>
      </div>
    </OwnerDashboardShell>
  )
}
