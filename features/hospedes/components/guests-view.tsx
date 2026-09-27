import Link from 'next/link'
import { UserRound, Users2 } from 'lucide-react'
import { OwnerDashboardShell } from '@/components/dashboard/owner-shell'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import type { GuestFilters } from '../schemas'
import type { GuestListItem } from '../types'

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso))
}

export function GuestsView({
  displayName,
  pousadaName,
  guests,
  filters,
}: {
  displayName: string
  pousadaName: string
  guests: GuestListItem[]
  filters: GuestFilters
}) {
  return (
    <OwnerDashboardShell
      section="hospedes"
      brandLabel={pousadaName}
      brandSub="Painel do proprietário"
      title="Hóspedes"
      subtitle="Cadastro de hóspedes desta pousada — com ou sem conta na plataforma."
      user={{ name: displayName, role: 'Proprietário' }}
    >
      <div className="space-y-5">
        <Card className="p-5">
          <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" method="get">
            <input
              name="name"
              defaultValue={filters.name ?? ''}
              placeholder="Nome"
              className="border-input bg-card text-foreground focus:border-ring rounded-lg border px-3 py-2 text-sm outline-none"
            />
            <input
              name="email"
              defaultValue={filters.email ?? ''}
              placeholder="E-mail"
              className="border-input bg-card text-foreground focus:border-ring rounded-lg border px-3 py-2 text-sm outline-none"
            />
            <input
              name="phone"
              defaultValue={filters.phone ?? ''}
              placeholder="Telefone"
              className="border-input bg-card text-foreground focus:border-ring rounded-lg border px-3 py-2 text-sm outline-none"
            />
            <input
              name="document"
              defaultValue={filters.document ?? ''}
              placeholder="Documento"
              className="border-input bg-card text-foreground focus:border-ring rounded-lg border px-3 py-2 text-sm outline-none"
            />
            <div className="text-muted-foreground flex items-center gap-3 text-sm">
              <label className="inline-flex items-center gap-1.5">
                <input
                  type="checkbox"
                  name="recurrentOnly"
                  value="1"
                  defaultChecked={filters.recurrentOnly}
                />
                Recorrente
              </label>
              <label className="inline-flex items-center gap-1.5">
                <input
                  type="checkbox"
                  name="incompleteOnly"
                  value="1"
                  defaultChecked={filters.incompleteOnly}
                />
                Incompleto
              </label>
              <button
                type="submit"
                className="bg-primary text-primary-foreground ml-auto rounded-lg px-3 py-1.5 text-xs font-semibold"
              >
                Filtrar
              </button>
            </div>
          </form>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-foreground font-semibold">Hóspedes</h2>
            <span className="text-muted-foreground text-sm">{guests.length} no total</span>
          </div>
          <div className="mt-4">
            {guests.length === 0 ? (
              <EmptyState
                icon={Users2}
                title="Nenhum hóspede encontrado"
                description="Cadastre hóspedes ao criar uma reserva administrativa, ou ajuste os filtros."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Cidade</TableHead>
                    <TableHead>Documento</TableHead>
                    <TableHead>Reservas</TableHead>
                    <TableHead>Última reserva</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {guests.map((guest) => (
                    <TableRow key={guest.id}>
                      <TableCell className="text-foreground font-medium">
                        <span className="inline-flex items-center gap-2">
                          <UserRound className="text-primary size-4" />
                          {guest.preferredName || guest.fullName}
                          {guest.isIncomplete && (
                            <Badge variant="goldSoft" size="sm">
                              Incompleto
                            </Badge>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <div>{guest.email ?? '—'}</div>
                        <div className="text-xs">{guest.phone ?? '—'}</div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{guest.city ?? '—'}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {guest.documentMasked ?? '—'}
                      </TableCell>
                      <TableCell>
                        {guest.bookingsCount > 1 ? (
                          <Badge variant="primarySoft" size="sm">
                            {guest.bookingsCount} · recorrente
                          </Badge>
                        ) : (
                          guest.bookingsCount
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {fmtDate(guest.lastBookingAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link
                          href={`/dashboard/hospedes/${guest.id}`}
                          className="text-primary text-sm font-semibold hover:underline"
                        >
                          Abrir perfil
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </Card>
      </div>
    </OwnerDashboardShell>
  )
}
