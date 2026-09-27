import type { InventoryCategory, InventoryUnit, MovementKind } from './labels'

export type InventoryItem = {
  id: string
  name: string
  category: InventoryCategory
  unit: InventoryUnit
  trackStock: boolean
  quantity: number
  minQuantity: number
  unitCost: number | null
  salePrice: number | null
  showInApp: boolean
  description: string
  photoUrl: string | null
  active: boolean
  sortOrder: number
}

export type InventoryMovement = {
  id: string
  itemId: string
  itemName: string
  kind: MovementKind
  quantity: number
  balanceAfter: number
  unitCost: number | null
  note: string
  orderId: string | null
  expenseId: string | null
  createdAt: string
}
