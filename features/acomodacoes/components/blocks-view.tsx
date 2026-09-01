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
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { AcomodacoesTabs } from './acomodacoes-tabs'
import { BLOCK_TYPE_LABEL } from './status-labels'
import { createBlockAction, cancelBlockAction } from '../actions'
import type { ManagedRoom, RoomBlock, RoomBlockType } from '../types'
import type { ActionResult } from '@/types'

function fmt(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(
    new Date(iso),
  )
}

function derivedStatus(block: RoomBlock): { label: string; variant: 'primarySoft' | 'secondary' | 'goldSoft' } {
  if (block.status === 'cancelled') return { label: 'Cancelado', variant: 'secondary' }
  const now = Date.now()
  if (new Date(block.endsAt).getTime() < now) return { label: 'Expirado', variant: 'secondary' }
  if (new Date(block.startsAt).getTime() > now) return { label: 'Futuro', variant: 'goldSoft' }
  return { label: 'Vigente', variant: 'primarySoft' }
}

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
    <form action={onSubmit} className="space-y-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Acomodação</span>
        <select name="roomId" required className="rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm text-foreground outline-none">
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
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tipo</span>
        <select name="blockType" className="rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm text-foreground outline-none">
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
      {error && <p className="text-sm font-medium text-destructive">{error}</p>}
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
}: {
  displayName: string
  pousadaName: string
  blocks: RoomBlock[]
  rooms: ManagedRoom[]
  canManage: boolean
}) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [cancelling, setCancelling] = useState<RoomBlock | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [roomFilter, setRoomFilter] = useState('')

  const filtered = useMemo(() => (roomFilter ? blocks.filter((b) => b.roomId === roomFilter) : blocks), [blocks, roomFilter])

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
            className="rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground outline-none"
          >
            <option value="">Todas as acomodações</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          {canManage && (
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" /> Novo bloqueio
            </Button>
          )}
        </div>
        {error && <p className="text-sm font-medium text-destructive">{error}</p>}

        <Card className="p-4">
          {filtered.length === 0 ? (
            <EmptyState icon={CalendarClock} title="Nenhum bloqueio" description="Não há períodos bloqueados para este filtro." />
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
                  const status = derivedStatus(b)
                  return (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium text-foreground">{b.roomName}</TableCell>
                      <TableCell className="text-muted-foreground">{BLOCK_TYPE_LABEL[b.blockType]}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {fmt(b.startsAt)} — {fmt(b.endsAt)}
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
            <Button variant="destructive" onClick={confirmCancel} disabled={cancelReason.trim().length < 3}>
              Cancelar bloqueio
            </Button>
          </>
        }
      >
        <Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={2} placeholder="Motivo do cancelamento" />
      </Dialog>
    </DashboardShell>
  )
}
