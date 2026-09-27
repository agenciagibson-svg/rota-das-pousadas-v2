import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { InventoryItem, InventoryMovement } from '@/features/estoque/types'
import type { InventoryCategory, InventoryUnit, MovementKind } from '@/features/estoque/labels'
import type { Json } from '@/lib/supabase/database.types'

/** Estoque (0078). Leitura pela RLS; escrita só pelas RPCs (travam o item). */

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

const ITEM_COLUMNS =
  'id, name, category, unit, track_stock, quantity, min_quantity, unit_cost, sale_price, show_in_app, description, photo_url, active, sort_order'

export async function listInventoryItems(pousadaId: string): Promise<InventoryItem[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('inventory_items')
    .select(ITEM_COLUMNS)
    .eq('pousada_id', pousadaId)
    .order('sort_order')
    .order('name')
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => toItem(r as ItemRow))
}

export async function getInventoryItem(
  id: string,
): Promise<(InventoryItem & { pousadaId: string }) | null> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('inventory_items')
    .select(`${ITEM_COLUMNS}, pousada_id`)
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return { ...toItem(data as ItemRow), pousadaId: (data as { pousada_id: string }).pousada_id }
}

export async function listInventoryMovements(
  pousadaId: string,
  opts: { itemId?: string; limit?: number } = {},
): Promise<InventoryMovement[]> {
  const supabase = await createSupabaseServerClient()
  let query = supabase
    .from('inventory_movements')
    .select(
      'id, item_id, kind, quantity, balance_after, unit_cost, note, order_id, expense_id, created_at',
    )
    .eq('pousada_id', pousadaId)
    .order('created_at', { ascending: false })
    .limit(opts.limit ?? 100)
  if (opts.itemId) query = query.eq('item_id', opts.itemId)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  const rows = data ?? []
  const ids = [...new Set(rows.map((r) => r.item_id))]
  const { data: names } = ids.length
    ? await supabase.from('inventory_items').select('id, name').in('id', ids)
    : { data: [] as { id: string; name: string }[] }
  const nameById = new Map((names ?? []).map((n) => [n.id, n.name]))
  return rows.map((r) => ({
    id: r.id,
    itemId: r.item_id,
    itemName: nameById.get(r.item_id) ?? 'Item',
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
