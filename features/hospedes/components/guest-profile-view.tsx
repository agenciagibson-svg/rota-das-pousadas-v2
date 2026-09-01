import Link from 'next/link'
import { DashboardShell } from '@/components/dashboard/shell'
import { ownerDashboardNav } from '@/components/dashboard/owner-nav'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { CalendarCheck } from 'lucide-react'
import { BOOKING_STATUS } from '@/features/reservas'
import type { BookingStatus } from '@/features/reservas'
import { GuestEditForm } from './guest-edit-form'
import type { GuestDetail } from '../types'

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso))
}

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
    <DashboardShell
      nav={ownerDashboardNav('hospedes')}
      brandLabel={pousadaName}
      brandSub="Painel do proprietário"
      title={guest.preferredName || guest.fullName}
      subtitle="Perfil do hóspede"
      user={{ name: displayName, role: 'Proprietário' }}
    >
      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Card className="p-6">
          <h2 className="font-semibold text-foreground">Dados do hóspede</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Cadastro interno desta pousada — não visível para outras pousadas.
          </p>
          <div className="mt-5">
            <GuestEditForm guest={guest} />
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold text-foreground">Histórico de reservas</h2>
          <div className="mt-4">
            {guest.bookings.length === 0 ? (
              <EmptyState icon={CalendarCheck} title="Nenhuma reserva ainda" description="Este hóspede ainda não tem reservas." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Acomodação</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {guest.bookings.map((b) => {
                    const status = BOOKING_STATUS[b.status as BookingStatus]
                    return (
                      <TableRow key={b.id}>
                        <TableCell>
                          <Link href={`/dashboard/reservas/${b.id}`} className="font-semibold text-primary hover:underline">
                            {b.code}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{b.roomName}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {fmtDate(b.checkin)} – {fmtDate(b.checkout)}
                        </TableCell>
                        <TableCell>
                          {status ? (
                            <Badge variant={status.variant} size="sm">
                              {status.label}
                            </Badge>
                          ) : (
                            b.status
                          )}
                        </TableCell>
                        <TableCell className="text-right text-foreground">R$ {b.total}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </Card>
      </div>
    </DashboardShell>
  )
}
