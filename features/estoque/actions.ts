'use server'

import { revalidatePath } from 'next/cache'
import { createAction } from '@/actions/create-action'
import {
  inventoryItemSchema,
  itemActiveSchema,
  movementSchema,
  movementsQuerySchema,
} from './schemas'
import {
  listItemMovements,
  registerMovement,
  saveItem,
  setItemActive,
} from './services/inventory.service'

export const saveInventoryItemAction = createAction(inventoryItemSchema, async (input) => {
  const id = await saveItem(input)
  revalidatePath('/dashboard/estoque')
  return { id }
})

export const setInventoryItemActiveAction = createAction(itemActiveSchema, async (input) => {
  await setItemActive(input.itemId, input.active)
  revalidatePath('/dashboard/estoque')
  return { ok: true as const }
})

export const registerMovementAction = createAction(movementSchema, async (input) => {
  const res = await registerMovement(input)
  revalidatePath('/dashboard/estoque')
  if (res.expenseCreated) revalidatePath('/dashboard/financeiro')
  return res
})

export const listItemMovementsAction = createAction(movementsQuerySchema, async (input) => {
  if (!input.itemId) return []
  return listItemMovements(input.itemId)
})
