import 'server-only'
import { can, type Role } from '@/lib/auth/rbac'
import { requireCapability } from '@/lib/auth/require-capability'
import {
  getInventoryItem,
  listInventoryItems,
  listInventoryMovements,
  registerMovementRpc,
  saveInventoryItemRpc,
  setInventoryItemActiveRpc,
} from '@/repositories/inventory.repository'
import type { InventoryItem, InventoryMovement } from '../types'
import type { inventoryItemSchema, movementSchema } from '../schemas'
import type { z } from 'zod'

/** O que cada papel pode fazer na tela (espelha as RPCs de 0078). */
export type InventoryPermissions = {
  manage: boolean
  move: boolean
  adjust: boolean
  seeCosts: boolean
}

export function inventoryPermissions(role: Role): InventoryPermissions {
  return {
    manage: can(role, 'inventory:manage'),
    move: can(role, 'inventory:move'),
    adjust: can(role, 'inventory:manage') || role === 'governanca',
    // Custo é dado financeiro: governança não vê (regra do escopo de negócio).
    seeCosts: can(role, 'finance:pousada:view') || can(role, 'inventory:manage'),
  }
}

export async function getInventoryScreen(): Promise<{
  items: InventoryItem[]
  movements: InventoryMovement[]
  permissions: InventoryPermissions
  pousadaId: string
}> {
  const { pousadaId, role } = await requireCapability('inventory:view')
  const permissions = inventoryPermissions(role)
  const [items, movements] = await Promise.all([
    listInventoryItems(pousadaId),
    listInventoryMovements(pousadaId, { limit: 60 }),
  ])
  const hideCost = !permissions.seeCosts
  return {
    items: hideCost ? items.map((i) => ({ ...i, unitCost: null })) : items,
    movements: hideCost ? movements.map((m) => ({ ...m, unitCost: null })) : movements,
    permissions,
    pousadaId,
  }
}

export async function listItemMovements(itemId: string): Promise<InventoryMovement[]> {
  const { pousadaId, role } = await requireCapability('inventory:view')
  const movements = await listInventoryMovements(pousadaId, { itemId, limit: 200 })
  return inventoryPermissions(role).seeCosts
    ? movements
    : movements.map((m) => ({ ...m, unitCost: null }))
}

export async function saveItem(input: z.output<typeof inventoryItemSchema>): Promise<string> {
  const { pousadaId } = await requireCapability('inventory:manage')
  if (input.id) {
    const existing = await getInventoryItem(input.id)
    if (!existing || existing.pousadaId !== pousadaId) throw new Error('Item não encontrado.')
  }
  return saveInventoryItemRpc(pousadaId, input.id ?? null, {
    name: input.name,
    category: input.category,
    unit: input.unit,
    trackStock: input.trackStock,
    initialQuantity: input.id ? 0 : input.initialQuantity,
    minQuantity: input.trackStock ? input.minQuantity : 0,
    unitCost: input.unitCost,
    salePrice: input.salePrice,
    showInApp: input.showInApp,
    description: input.description,
    photoUrl: input.photoUrl,
  })
}

export async function setItemActive(itemId: string, active: boolean): Promise<void> {
  const { pousadaId } = await requireCapability('inventory:manage')
  const existing = await getInventoryItem(itemId)
  if (!existing || existing.pousadaId !== pousadaId) throw new Error('Item não encontrado.')
  await setInventoryItemActiveRpc(itemId, active)
}

export async function registerMovement(
  input: z.output<typeof movementSchema>,
): Promise<{ balance: number; expenseCreated: boolean }> {
  const { pousadaId, role } = await requireCapability('inventory:move')
  const perms = inventoryPermissions(role)
  if (input.kind === 'ajuste' && !perms.adjust)
    throw new Error('Seu perfil não pode ajustar o estoque.')
  if (input.createExpense && !perms.manage) {
    throw new Error('Só proprietário ou gestor lançam a compra no Financeiro.')
  }
  const existing = await getInventoryItem(input.itemId)
  if (!existing || existing.pousadaId !== pousadaId) throw new Error('Item não encontrado.')
  const res = await registerMovementRpc({
    itemId: input.itemId,
    kind: input.kind,
    quantity: input.quantity,
    unitCost: input.kind === 'entrada' ? input.unitCost : null,
    note: input.note,
    createExpense: input.kind === 'entrada' && input.createExpense,
  })
  return { balance: res.balance, expenseCreated: !!res.expenseId }
}
