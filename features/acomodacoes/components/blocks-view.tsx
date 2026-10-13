'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarClock, Plus, X } from 'lucide-react'
import { DashboardShell } from '@/components/dashboard/shell'
import { ownerDashboardNav } from '@/components/dashboard/owner-nav'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { AcomodacoesTabs } from './acomodacoes-tabs'
import { BLOCK_TYPE_LABEL } from './status-labels'
import { createBlockAction, cancelBlockAction } from '../actions'
import { blockTimeStatus, formatBlockPeriod } from '../block-time'
import type { ManagedRoom, RoomBlock, RoomBlockType } from '../types'
import type { ActionResult } from '@/types'
import { keepValuesOnSubmit } from '@/lib/forms'

const BLOCK_TYPES: RoomBlockType[] = [
  'maintenance',
  'internal_use',
  'owner_reservation',
  'interdiction',
  'renovation',
  'operational_unavailability',
  'other',
]

function NewBlockForm({ rooms, onDone }: { rooms: ManagedRoom[]; onDone: () => void }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(formData: FormData) {
    setError(null)
    setPending(true)
    const result = await createBlockAction({
      roomId: String(formData.get('roomId') ?? ''),
      blockType: String(formData.get('blockType') ?? 'other') as RoomBlockType,
      startsAt: String(formData.get('startsAt') ?? ''),
      endsAt: String(formData.get('endsAt') ?? ''),
      reason: String(formData.get('reason') ?? ''),
      notes: String(formData.get('notes') ?? ''),
    })
    setPending(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    router.refresh()
    onDone()
  }

  return (
    <form onSubmit={keepValuesOnSubmit(onSubmit)} className="space-y-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-foreground text-sm font-medium">Acomodação</span>
        <select
          name="roomId"
          required
          className="border-input bg-card text-foreground rounded-xl border px-3.5 py-2.5 text-sm outline-none"
        >
          <option value="">Selecione…</option>
          {rooms
            .filter((r) => r.status === 'active')
            .map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-foreground text-sm font-medium">Tipo</span>
        <select
          name="blockType"
          className="border-input bg-card text-foreground rounded-xl border px-3.5 py-2.5 text-sm outline-none"
        >
          {BLOCK_TYPES.map((t) => (
            <option key={t} value={t}>
              {BLOCK_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Início" name="startsAt" type="datetime-local" required />
        <Input label="Fim" name="endsAt" type="datetime-local" required />
      </div>
      <Textarea label="Motivo" name="reason" rows={2} required />
      <Textarea label="Observações (opcional)" name="notes" rows={2} />
      {error && <p className="text-destructive text-sm font-medium">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? 'Criando…' : 'Bloquear período'}
        </Button>
      </div>
    </form>
  )
}

export function BlocksView({
  displayName,
  pousadaName,
  blocks,
  rooms,
  canManage,
  nowCivilISO,
}: {
  displayName: string
  pousadaName: string
  blocks: RoomBlock[]
  rooms: ManagedRoom[]
  canManage: boolean
  /** Relógio da pousada no referencial dos bloqueios (`civilNow`), calculado no servidor. */
  nowCivilISO: string
}) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [cancelling, setCancelling] = useState<RoomBlock | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [roomFilter, setRoomFilter] = useState('')
  const [showOld, setShowOld] = useState(false)
  const nowCivilMs = new Date(nowCivilISO).getTime()

  // Por padrão só o que ainda vale (vigente ou futuro); cancelados e
  // expirados ficam atrás de uma opção, senão a lista vira histórico.
  const filtered = useMemo(() => {
    const isCurrent = (b: RoomBlock) =>
      b.status === 'active' && new Date(b.endsAt).getTime() >= nowCivilMs
    return blocks.filter(
      (b) => (!roomFilter || b.roomId === roomFilter) && (showOld || isCurrent(b)),
    )
  }, [blocks, roomFilter, showOld, nowCivilMs])
  const hiddenCount = blocks.filter(
    (b) =>
      (!roomFilter || b.roomId === roomFilter) &&
      !(b.status === 'active' && new Date(b.endsAt).getTime() >= nowCivilMs),
  ).length

  function run(promise: Promise<ActionResult<unknown>>) {
    setError(null)
    setPending(true)
    promise.then((result) => {
      setPending(false)
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  function confirmCancel() {
    if (!cancelling) return
    const target = cancelling
    setCancelling(null)
    run(cancelBlockAction({ id: target.id, cancellationReason: cancelReason }))
    setCancelReason('')
  }

  return (
    <DashboardShell
      nav={ownerDashboardNav('acomodacoes')}
      brandLabel={pousadaName}
      brandSub="Painel do proprietário"
      title="Bloqueios"
      subtitle="Períodos indisponíveis por manutenção, reforma ou uso interno."
      user={{ name: displayName, role: 'Proprietário' }}
    >
      <AcomodacoesTabs active="bloqueios" />

      <div className="mt-5 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <select
            value={roomFilter}
            onChange={(e) => setRoomFilter(e.target.value)}
            className="border-input bg-card text-foreground rounded-xl border px-3 py-2 text-sm outline-none"
          >
            <option value="">Todas as acomodações</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          {hiddenCount > 0 && (
            <label className="text-muted-foreground flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4"
                checked={showOld}
                onChange={(e) => setShowOld(e.target.checked)}
              />
              Mostrar cancelados e encerrados ({hiddenCount})
            </label>
          )}
          {canManage && (
            <Button className="ml-auto" onClick={() => setCreating(true)}>
              <Plus className="size-4" /> Novo bloqueio
            </Button>
          )}
        </div>
        {error && <p className="text-destructive text-sm font-medium">{error}</p>}

        <Card className="p-4">
          {filtered.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              title="Nenhum bloqueio"
              description={
                hiddenCount > 0 && !showOld
                  ? 'Nenhum bloqueio valendo agora. Marque “Mostrar cancelados e encerrados” para ver o histórico.'
                  : 'Não há períodos bloqueados para este filtro.'
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Acomodação</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Situação</TableHead>
                  {canManage && <TableHead className="text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((b) => {
                  const status = blockTimeStatus(b, nowCivilMs)
                  return (
                    <TableRow key={b.id}>
                      <TableCell className="text-foreground font-medium">{b.roomName}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {BLOCK_TYPE_LABEL[b.blockType]}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatBlockPeriod(b.startsAt, b.endsAt)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{b.reason}</TableCell>
                      <TableCell>
                        <Badge variant={status.variant} size="sm">
                          {status.label}
                        </Badge>
                      </TableCell>
                      {canManage && (
                        <TableCell className="text-right">
                          {b.status === 'active' && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              disabled={pending}
                              aria-label={`Cancelar bloqueio de ${b.roomName}`}
                              onClick={() => setCancelling(b)}
                            >
                              <X />
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>

      <Dialog open={creating} onClose={() => setCreating(false)} title="Novo bloqueio">
        <NewBlockForm rooms={rooms} onDone={() => setCreating(false)} />
      </Dialog>

      <Dialog
        open={cancelling !== null}
        onClose={() => setCancelling(null)}
        title={`Cancelar bloqueio de ${cancelling?.roomName ?? ''}`}
        description="A acomodação volta a ficar disponível para esse período."
        footer={
          <>
            <Button variant="ghost" onClick={() => setCancelling(null)}>
              Voltar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmCancel}
              disabled={cancelReason.trim().length < 3}
            >
              Cancelar bloqueio
            </Button>
          </>
        }
      >
        <Textarea
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
          rows={2}
          placeholder="Motivo do cancelamento"
        />
      </Dialog>
    </DashboardShell>
  )
}
