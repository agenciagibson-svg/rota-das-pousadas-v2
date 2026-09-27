'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BedDouble, Ban, Plus, RotateCcw, Search } from 'lucide-react'
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
import { AcomodacoesTabs } from './acomodacoes-tabs'
import { RoomForm } from './room-form'
import { OPERATIONAL_STATUS_LABEL } from './status-labels'
import { setRoomStatusAction, setRoomOperationalStatusAction } from '../actions'
import type { ManagedRoom, AccommodationCategory, RoomOperationalStatus } from '../types'
import type { ActionResult } from '@/types'
import { formatBRL } from '@/lib/format'

const OPERATIONAL_OPTIONS: RoomOperationalStatus[] = [
  'available',
  'occupied',
  'awaiting_cleaning',
  'cleaning',
  'inspection_pending',
  'maintenance',
  'blocked',
]

export function RoomsView({
  displayName,
  pousadaName,
  rooms,
  categories,
  amenities,
  canManage,
  canChangeOperationalStatus,
}: {
  displayName: string
  pousadaName: string
  rooms: ManagedRoom[]
  categories: AccommodationCategory[]
  amenities: { id: string; name: string }[]
  canManage: boolean
  canChangeOperationalStatus: boolean
}) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [editing, setEditing] = useState<ManagedRoom | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [toggling, setToggling] = useState<ManagedRoom | null>(null)

  const filtered = useMemo(() => {
    return rooms.filter((r) => {
      if (search && !`${r.name} ${r.code ?? ''}`.toLowerCase().includes(search.toLowerCase()))
        return false
      if (categoryFilter && r.categoryId !== categoryFilter) return false
      if (statusFilter && r.status !== statusFilter) return false
      return true
    })
  }, [rooms, search, categoryFilter, statusFilter])

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

  return (
    <DashboardShell
      nav={ownerDashboardNav('acomodacoes')}
      brandLabel={pousadaName}
      brandSub="Painel do proprietário"
      title="Acomodações"
      subtitle="Inventário operacional — não é a vitrine pública."
      user={{ name: displayName, role: 'Proprietário' }}
    >
      <AcomodacoesTabs active="inventario" />

      <div className="mt-5 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-foreground font-semibold">
              {rooms.length === 1 ? '1 acomodação' : `${rooms.length} acomodações`} no total
            </h2>
            {canManage && rooms.length > 0 && (
              <p className="text-muted-foreground text-sm">
                Clique no nome para editar preço, capacidade e descrição.
              </p>
            )}
            {error && <p className="text-destructive text-sm font-medium">{error}</p>}
          </div>
          {canManage && (
            <Button onClick={() => setEditing('new')}>
              <Plus className="size-4" />
              Nova acomodação
            </Button>
          )}
        </div>

        <Card className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="border-input bg-card flex min-w-48 flex-1 items-center gap-2 rounded-xl border px-3 py-2">
              <Search className="text-muted-foreground size-4" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome ou código"
                className="placeholder:text-muted-foreground w-full bg-transparent text-sm outline-none"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="border-input bg-card text-foreground rounded-xl border px-3 py-2 text-sm outline-none"
            >
              <option value="">Todas as categorias</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border-input bg-card text-foreground rounded-xl border px-3 py-2 text-sm outline-none"
            >
              <option value="">Ativas e inativas</option>
              <option value="active">Só ativas</option>
              <option value="inactive">Só inativas</option>
            </select>
          </div>
        </Card>

        <Card className="p-4">
          {rooms.length === 0 ? (
            <EmptyState
              icon={BedDouble}
              title="Nenhuma acomodação cadastrada"
              description="Cadastre a primeira acomodação real desta pousada."
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Search}
              title="Nenhum resultado"
              description="Ajuste a busca ou os filtros."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome / código</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Capacidade</TableHead>
                  <TableHead>Diária base</TableHead>
                  <TableHead>Status operacional</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => {
                  const opStatus = OPERATIONAL_STATUS_LABEL[r.operationalStatus]
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <button
                          onClick={() => canManage && setEditing(r)}
                          className="text-foreground text-left font-medium hover:underline"
                        >
                          {r.name}
                        </button>
                        {r.code && <div className="text-muted-foreground text-xs">{r.code}</div>}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {r.categoryName ?? '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        até {r.capacityMax ?? r.capacity}
                      </TableCell>
                      <TableCell className="text-foreground whitespace-nowrap">
                        {r.basePrice != null ? formatBRL(r.basePrice) : '—'}
                      </TableCell>
                      <TableCell>
                        {canChangeOperationalStatus ? (
                          <select
                            value={r.operationalStatus}
                            disabled={pending}
                            onChange={(e) =>
                              run(
                                setRoomOperationalStatusAction({
                                  id: r.id,
                                  status: e.target.value as RoomOperationalStatus,
                                }),
                              )
                            }
                            className="border-input bg-card text-foreground rounded-lg border px-2 py-1 text-xs outline-none"
                          >
                            {OPERATIONAL_OPTIONS.map((s) => (
                              <option key={s} value={s}>
                                {OPERATIONAL_STATUS_LABEL[s].label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <Badge variant={opStatus.variant} size="sm">
                            {opStatus.label}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={r.status === 'active' ? 'primarySoft' : 'secondary'}
                          size="sm"
                        >
                          {r.status === 'active' ? 'Ativa' : 'Inativa'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {canManage && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            disabled={pending}
                            aria-label={
                              r.status === 'active' ? `Inativar ${r.name}` : `Reativar ${r.name}`
                            }
                            onClick={() =>
                              r.status === 'active'
                                ? setToggling(r)
                                : run(setRoomStatusAction({ id: r.id, status: 'active' }))
                            }
                          >
                            {r.status === 'active' ? <Ban /> : <RotateCcw />}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>

      <Dialog
        open={toggling !== null}
        onClose={() => setToggling(null)}
        title={`Inativar ${toggling?.name ?? ''}?`}
        description="A acomodação sai da venda: não aparece no site nem aceita reservas novas. As reservas já feitas continuam valendo. Dá para reativar depois."
        footer={
          <>
            <Button variant="ghost" onClick={() => setToggling(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => {
                if (!toggling) return
                run(setRoomStatusAction({ id: toggling.id, status: 'inactive' }))
                setToggling(null)
              }}
            >
              Inativar
            </Button>
          </>
        }
      />

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Nova acomodação' : `Editar ${editing ? editing.name : ''}`}
        className="max-w-2xl"
      >
        {editing !== null && (
          <RoomForm
            room={editing === 'new' ? undefined : editing}
            categories={categories}
            amenities={amenities}
            onDone={() => setEditing(null)}
          />
        )}
      </Dialog>
    </DashboardShell>
  )
}
