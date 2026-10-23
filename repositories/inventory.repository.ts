import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { InventoryItem, InventoryMovement } from '@/features/estoque/types'
import type { InventoryCategory, InventoryUnit, MovementKind } from '@/features/estoque/labels'
import type { Json } from '@/lib/supabase/database.types'

/**
 * Estoque (0078). Leitura pelas RPCs da 0092, que escondem o custo de compra de
 * quem não é proprietário, gestor ou financeiro (a leitura direta da tabela é
 * só desses papéis). Escrita só pelas RPCs que travam o item.
 */

type ItemRow = {
  id: string
  name: string
  category: string
  unit: string
  track_stock: boolean
  quantity: number
  min_quantity: number
  unit_cost: number | null
  sale_price: number | null
  show_in_app: boolean
  description: string
  photo_url: string | null
  active: boolean
  sort_order: number
}

function toItem(r: ItemRow): InventoryItem {
  return {
    id: r.id,
    name: r.name,
    category: r.category as InventoryCategory,
    unit: r.unit as InventoryUnit,
    trackStock: r.track_stock,
    quantity: Number(r.quantity),
    minQuantity: Number(r.min_quantity),
    unitCost: r.unit_cost == null ? null : Number(r.unit_cost),
    salePrice: r.sale_price == null ? null : Number(r.sale_price),
    showInApp: r.show_in_app,
    description: r.description,
    photoUrl: r.photo_url,
    active: r.active,
    sortOrder: r.sort_order,
  }
}

export async function listInventoryItems(pousadaId: string): Promise<InventoryItem[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('list_inventory_items', { p_pousada_id: pousadaId })
  if (error) throw new Error(error.message)
  return ((data ?? []) as ItemRow[]).map(toItem)
}

export async function getInventoryItem(
  id: string,
): Promise<(InventoryItem & { pousadaId: string }) | null> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('get_inventory_item', { p_item_id: id })
  if (error) throw new Error(error.message)
  const row = ((data ?? []) as (ItemRow & { pousada_id: string })[])[0]
  if (!row) return null
  return { ...toItem(row), pousadaId: row.pousada_id }
}

export async function listInventoryMovements(
  pousadaId: string,
  opts: { itemId?: string; limit?: number } = {},
): Promise<InventoryMovement[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('list_inventory_movements', {
    p_pousada_id: pousadaId,
    p_item_id: opts.itemId ?? null,
    p_limit: opts.limit ?? 100,
  })
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as {
    id: string
    item_id: string
    item_name: string
    kind: string
    quantity: number
    balance_after: number
    unit_cost: number | null
    note: string
    order_id: string | null
    expense_id: string | null
    created_at: string
  }[]
  return rows.map((r) => ({
    id: r.id,
    itemId: r.item_id,
    itemName: r.item_name,
    kind: r.kind as MovementKind,
    quantity: Number(r.quantity),
    balanceAfter: Number(r.balance_after),
    unitCost: r.unit_cost == null ? null : Number(r.unit_cost),
    note: r.note,
    orderId: r.order_id,
    expenseId: r.expense_id,
    createdAt: r.created_at,
  }))
}

export async function saveInventoryItemRpc(
  pousadaId: string,
  itemId: string | null,
  data: Record<string, unknown>,
): Promise<string> {
  const supabase = await createSupabaseServerClient()
  const { data: res, error } = await supabase.rpc('save_inventory_item', {
    p_pousada_id: pousadaId,
    p_item_id: itemId,
    p_data: data as Json,
  })
  if (error) throw new Error(error.message)
  return (res as { id: string }).id
}

export async function setInventoryItemActiveRpc(itemId: string, active: boolean): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc('set_inventory_item_active', {
    p_item_id: itemId,
    p_active: active,
  })
  if (error) throw new Error(error.message)
}

export async function registerMovementRpc(input: {
  itemId: string
  kind: 'entrada' | 'saida' | 'perda' | 'ajuste'
  quantity: number
  unitCost: number | null
  note: string
  createExpense: boolean
}): Promise<{ balance: number; expenseId: string | null }> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('register_inventory_movement', {
    p_item_id: input.itemId,
    p_kind: input.kind,
    p_quantity: input.quantity,
    p_unit_cost: input.unitCost,
    p_note: input.note,
    p_create_expense: input.createExpense,
  })
  if (error) throw new Error(error.message)
  const r = data as { balance: number; expenseId: string | null }
  return { balance: Number(r.balance), expenseId: r.expenseId }
}
