'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BedDouble } from 'lucide-react'
import { DashboardShell } from '@/components/dashboard/shell'
import { ownerDashboardNav } from '@/components/dashboard/owner-nav'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { OPERATIONAL_STATUS_LABEL } from './status-labels'
import { setRoomOperationalStatusAction } from '../actions'
import type { HousekeepingRoom, RoomOperationalStatus } from '../types'

const OPERATIONAL_OPTIONS: RoomOperationalStatus[] = [
  'available',
  'occupied',
  'awaiting_cleaning',
  'cleaning',
  'inspection_pending',
  'maintenance',
  'blocked',
]

function fmt(iso: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}

/**
 * [Ciclo 3B] Visão exclusiva de Governança — só o que a projeção
 * `list_rooms_for_housekeeping` retorna. Sem preço, categoria ou dados
 * comerciais: nem a interface pede, nem a RPC devolveria.
 */
export function HousekeepingRoomsView({
  displayName,
  pousadaName,
  rooms,
}: {
  displayName: string
  pousadaName: string
  rooms: HousekeepingRoom[]
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function changeStatus(id: string, status: RoomOperationalStatus) {
    setError(null)
    setPending(true)
    setRoomOperationalStatusAction({ id, status }).then((result) => {
      setPending(false)
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <DashboardShell
      nav={ownerDashboardNav('acomodacoes')}
      brandLabel={pousadaName}
      brandSub="Painel de governança"
      title="Acomodações"
      subtitle="Situação operacional das acomodações — sem dados comerciais."
      user={{ name: displayName, role: 'Governança' }}
    >
      <Card className="p-4">
        {error && <p className="mb-3 text-sm font-medium text-destructive">{error}</p>}
        {rooms.length === 0 ? (
          <EmptyState icon={BedDouble} title="Nenhuma acomodação" description="Não há acomodações cadastradas nesta pousada." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome / código</TableHead>
                <TableHead>Localização</TableHead>
                <TableHead>Capacidade</TableHead>
                <TableHead>Status operacional</TableHead>
                <TableHead>Próximo bloqueio</TableHead>
                <TableHead>Observação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rooms.map((r) => {
                const status = OPERATIONAL_STATUS_LABEL[r.operationalStatus]
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium text-foreground">{r.name}</div>
                      {r.code && <div className="text-xs text-muted-foreground">{r.code}</div>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{r.location || '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{r.capacity}</TableCell>
                    <TableCell>
                      <select
                        value={r.operationalStatus}
                        disabled={pending}
                        onChange={(e) => changeStatus(r.id, e.target.value as RoomOperationalStatus)}
                        className="rounded-lg border border-input bg-card px-2 py-1 text-xs text-foreground outline-none"
                      >
                        {OPERATIONAL_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {OPERATIONAL_STATUS_LABEL[s].label}
                          </option>
                        ))}
                      </select>
                      <Badge variant={status.variant} size="sm" className="ml-2">
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{fmt(r.nextBlockStartsAt)}</TableCell>
                    <TableCell className="text-muted-foreground">{r.operationalNote || '—'}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </DashboardShell>
  )
}
