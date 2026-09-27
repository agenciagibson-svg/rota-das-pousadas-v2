'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ArrowDownUp,
  History,
  Package,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Smartphone,
  Ban,
} from 'lucide-react'
import { DashboardShell } from '@/components/dashboard/shell'
import { ownerDashboardNav } from '@/components/dashboard/owner-nav'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { formatBRL, formatDateTime } from '@/lib/format'
import { listItemMovementsAction, setInventoryItemActiveAction } from '../actions'
import {
  CATEGORY_LABEL,
  INVENTORY_CATEGORIES,
  MOVEMENT_LABEL,
  formatQty,
  isLowStock,
  qtyWithUnit,
  type InventoryCategory,
} from '../labels'
import type { InventoryItem, InventoryMovement } from '../types'
import type { InventoryPermissions } from '../services/inventory.service'
import { ItemForm } from './item-form'
import { MovementForm } from './movement-form'

type Dialogs =
  | { kind: 'new' }
  | { kind: 'edit'; item: InventoryItem }
  | { kind: 'move'; item: InventoryItem }
  | { kind: 'history'; item: InventoryItem }
  | { kind: 'deactivate'; item: InventoryItem }
  | null

function MovementRow({ m, showItem }: { m: InventoryMovement; showItem: boolean }) {
  const positive = m.quantity > 0
  return (
    <li className="flex items-start justify-between gap-3 py-2.5 text-sm">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={
              positive ? 'primarySoft' : m.kind === 'perda' ? 'destructiveSoft' : 'secondary'
            }
            size="sm"
          >
            {MOVEMENT_LABEL[m.kind]}
          </Badge>
          {showItem && <span className="text-foreground truncate font-medium">{m.itemName}</span>}
        </div>
        <p className="text-muted-foreground mt-0.5 text-xs">
          {formatDateTime(m.createdAt)}
          {m.note ? ` · ${m.note}` : ''}
          {m.expenseId ? ' · lançado no Financeiro' : ''}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <div className={`font-semibold ${positive ? 'text-emerald-700' : 'text-foreground'}`}>
          {positive ? '+' : '−'}
          {formatQty(Math.abs(m.quantity))}
        </div>
        <div className="text-muted-foreground text-xs">fica {formatQty(m.balanceAfter)}</div>
      </div>
    </li>
  )
}

export function InventoryView({
  displayName,
  pousadaName,
  pousadaId,
  items,
  movements,
  permissions,
}: {
  displayName: string
  pousadaName: string
  pousadaId: string
  items: InventoryItem[]
  movements: InventoryMovement[]
  permissions: InventoryPermissions
}) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<InventoryCategory | ''>('')
  const [onlyLow, setOnlyLow] = useState(false)
  const [showInactive, setShowInactive] = useState(false)
  const [dialog, setDialog] = useState<Dialogs>(null)
  const [history, setHistory] = useState<InventoryMovement[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const active = items.filter((i) => i.active)
  const low = active.filter(isLowStock)
  const inApp = active.filter((i) => i.showInApp)
  const stockValue = active.reduce(
    (sum, i) => sum + (i.trackStock && i.unitCost ? i.unitCost * i.quantity : 0),
    0,
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items
      .filter((i) => (showInactive ? true : i.active))
      .filter((i) => (category ? i.category === category : true))
      .filter((i) => (onlyLow ? i.active && isLowStock(i) : true))
      .filter((i) => (q ? i.name.toLowerCase().includes(q) : true))
      .sort((a, b) => Number(isLowStock(b)) - Number(isLowStock(a)) || a.name.localeCompare(b.name))
  }, [items, search, category, onlyLow, showInactive])

  async function openHistory(item: InventoryItem) {
    setDialog({ kind: 'history', item })
    setHistory(null)
    const res = await listItemMovementsAction({ itemId: item.id })
    setHistory(res.ok ? res.data : [])
  }

  async function toggleActive(item: InventoryItem, next: boolean) {
    setError(null)
    setPending(true)
    try {
      const res = await setInventoryItemActiveAction({ itemId: item.id, active: next })
      if (!res.ok) {
        setError(res.error)
        return
      }
      setDialog(null)
      router.refresh()
    } catch {
      setError('Não foi possível alterar o item.')
    } finally {
      setPending(false)
    }
  }

  return (
    <DashboardShell
      nav={ownerDashboardNav('estoque')}
      brandLabel={pousadaName}
      brandSub="Painel do proprietário"
      title="Estoque"
      subtitle="Bebidas, frigobar, enxoval e insumos — com aviso quando estiver acabando."
      user={{ name: displayName, role: 'Proprietário' }}
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5">
          <div className="text-muted-foreground text-sm">Itens ativos</div>
          <div className="text-foreground mt-2 text-3xl font-semibold">{active.length}</div>
        </Card>
        <button
          type="button"
          onClick={() => setOnlyLow((v) => !v)}
          className={`rounded-2xl border p-5 text-left transition-colors ${
            low.length > 0 ? 'border-amber-300 bg-amber-50' : 'border-border bg-card'
          }`}
        >
          <div className="text-muted-foreground flex items-center gap-1.5 text-sm">
            {low.length > 0 && <AlertTriangle className="size-4 text-amber-600" />}
            Acabando
          </div>
          <div className="text-foreground mt-2 text-3xl font-semibold">{low.length}</div>
          {low.length > 0 && (
            <div className="mt-1 text-xs text-amber-800">
              {onlyLow ? 'Mostrando só estes' : 'Toque para ver'}
            </div>
          )}
        </button>
        <Card className="p-5">
          <div className="text-muted-foreground text-sm">No app do hóspede</div>
          <div className="text-foreground mt-2 text-3xl font-semibold">{inApp.length}</div>
        </Card>
        {permissions.seeCosts && (
          <Card className="p-5">
            <div className="text-muted-foreground text-sm">Valor em estoque (custo)</div>
            <div className="text-foreground mt-2 text-3xl font-semibold">
              {formatBRL(stockValue)}
            </div>
          </Card>
        )}
      </div>

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
        <Card className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="border-input bg-card flex min-w-48 flex-1 items-center gap-2 rounded-xl border px-3 py-2">
              <Search className="text-muted-foreground size-4" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar item"
                aria-label="Buscar item"
                className="placeholder:text-muted-foreground w-full bg-transparent text-sm outline-none"
              />
            </div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as InventoryCategory | '')}
              aria-label="Categoria"
              className="border-input bg-card text-foreground rounded-xl border px-3 py-2 text-sm outline-none"
            >
              <option value="">Todas as categorias</option>
              {INVENTORY_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
            {permissions.manage && (
              <Button onClick={() => setDialog({ kind: 'new' })}>
                <Plus className="size-4" />
                Novo item
              </Button>
            )}
          </div>
          <div className="text-muted-foreground mt-3 flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="size-4"
                checked={onlyLow}
                onChange={(e) => setOnlyLow(e.target.checked)}
              />
              Só o que está acabando
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="size-4"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
              />
              Mostrar inativos
            </label>
          </div>
          {error && (
            <p role="alert" className="text-destructive mt-3 text-sm font-medium">
              {error}
            </p>
          )}

          {items.length === 0 ? (
            <EmptyState
              className="mt-5"
              icon={Package}
              title="Nenhum item cadastrado"
              description={
                permissions.manage
                  ? 'Cadastre o que a pousada controla: bebidas do frigobar, café da manhã, enxoval, amenities. Marque "Mostrar no app" no que o hóspede pode pedir.'
                  : 'O proprietário ou gestor ainda não cadastrou itens.'
              }
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              className="mt-5"
              icon={Search}
              title="Nada encontrado"
              description="Ajuste a busca ou os filtros."
            />
          ) : (
            <ul className="divide-border mt-4 divide-y">
              {filtered.map((item) => {
                const lowStock = item.active && isLowStock(item)
                return (
                  <li key={item.id} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="bg-secondary relative size-12 shrink-0 overflow-hidden rounded-xl">
                      {item.photoUrl ? (
                        <Image
                          src={item.photoUrl}
                          alt=""
                          fill
                          sizes="48px"
                          className="object-cover"
                        />
                      ) : (
                        <Package className="text-muted-foreground absolute inset-0 m-auto size-5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`font-medium ${item.active ? 'text-foreground' : 'text-muted-foreground line-through'}`}
                        >
                          {item.name}
                        </span>
                        {item.showInApp && (
                          <Badge variant="primarySoft" size="sm">
                            <Smartphone className="mr-1 size-3" />
                            No app
                          </Badge>
                        )}
                        {!item.active && (
                          <Badge variant="secondary" size="sm">
                            Inativo
                          </Badge>
                        )}
                      </div>
                      <p className="text-muted-foreground text-xs">
                        {CATEGORY_LABEL[item.category]}
                        {item.salePrice != null &&
                          ` · venda ${item.salePrice === 0 ? 'cortesia' : formatBRL(item.salePrice)}`}
                        {permissions.seeCosts &&
                          item.unitCost != null &&
                          ` · custo ${formatBRL(item.unitCost)}`}
                      </p>
                    </div>
                    <div className="w-28 shrink-0 text-right">
                      {item.trackStock ? (
                        <>
                          <div
                            className={`font-semibold ${lowStock ? 'text-amber-700' : 'text-foreground'}`}
                          >
                            {qtyWithUnit(item.quantity, item.unit)}
                          </div>
                          <div
                            className={`text-xs ${lowStock ? 'text-amber-700' : 'text-muted-foreground'}`}
                          >
                            {lowStock ? 'acabando' : `mín. ${formatQty(item.minQuantity)}`}
                          </div>
                        </>
                      ) : (
                        <div className="text-muted-foreground text-xs">sem controle</div>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {item.trackStock && item.active && permissions.move && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDialog({ kind: 'move', item })}
                        >
                          <ArrowDownUp className="size-3.5" />
                          Movimentar
                        </Button>
                      )}
                      {item.trackStock && (
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Histórico de ${item.name}`}
                          onClick={() => void openHistory(item)}
                        >
                          <History />
                        </Button>
                      )}
                      {permissions.manage && (
                        <>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label={`Editar ${item.name}`}
                            onClick={() => setDialog({ kind: 'edit', item })}
                          >
                            <Pencil />
                          </Button>
                          {item.active ? (
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              aria-label={`Inativar ${item.name}`}
                              onClick={() => setDialog({ kind: 'deactivate', item })}
                            >
                              <Ban />
                            </Button>
                          ) : (
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              disabled={pending}
                              aria-label={`Reativar ${item.name}`}
                              onClick={() => void toggleActive(item, true)}
                            >
                              <RotateCcw />
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        <Card className="p-4 sm:p-5">
          <h2 className="text-foreground font-semibold">Últimas movimentações</h2>
          {movements.length === 0 ? (
            <p className="text-muted-foreground mt-2 text-sm">Nenhuma movimentação ainda.</p>
          ) : (
            <ul className="divide-border mt-2 divide-y">
              {movements.slice(0, 15).map((m) => (
                <MovementRow key={m.id} m={m} showItem />
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Dialog
        open={dialog?.kind === 'new' || dialog?.kind === 'edit'}
        onClose={() => setDialog(null)}
        title={dialog?.kind === 'edit' ? `Editar ${dialog.item.name}` : 'Novo item'}
        className="max-w-2xl"
      >
        {(dialog?.kind === 'new' || dialog?.kind === 'edit') && (
          <ItemForm
            item={dialog.kind === 'edit' ? dialog.item : undefined}
            pousadaId={pousadaId}
            seeCosts={permissions.seeCosts}
            onDone={() => setDialog(null)}
          />
        )}
      </Dialog>

      <Dialog
        open={dialog?.kind === 'move'}
        onClose={() => setDialog(null)}
        title={dialog?.kind === 'move' ? `Movimentar ${dialog.item.name}` : ''}
      >
        {dialog?.kind === 'move' && (
          <MovementForm
            item={dialog.item}
            permissions={permissions}
            onDone={() => setDialog(null)}
          />
        )}
      </Dialog>

      <Dialog
        open={dialog?.kind === 'history'}
        onClose={() => setDialog(null)}
        title={dialog?.kind === 'history' ? `Histórico — ${dialog.item.name}` : ''}
      >
        {history === null ? (
          <p className="text-muted-foreground text-sm">Carregando…</p>
        ) : history.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhuma movimentação ainda.</p>
        ) : (
          <ul className="divide-border max-h-[60vh] divide-y overflow-y-auto">
            {history.map((m) => (
              <MovementRow key={m.id} m={m} showItem={false} />
            ))}
          </ul>
        )}
      </Dialog>

      <Dialog
        open={dialog?.kind === 'deactivate'}
        onClose={() => setDialog(null)}
        title={dialog?.kind === 'deactivate' ? `Inativar ${dialog.item.name}?` : ''}
        description="O item sai da lista e do app do hóspede. O histórico continua guardado e dá para reativar depois."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => dialog?.kind === 'deactivate' && void toggleActive(dialog.item, false)}
            >
              Inativar
            </Button>
          </>
        }
      />
    </DashboardShell>
  )
}
