'use server'

import { revalidatePath } from 'next/cache'
import { createAction } from '@/actions/create-action'
import {
  roomSchema,
  roomIdSchema,
  roomStatusSchema,
  roomOperationalStatusSchema,
  categorySchema,
  categoryIdSchema,
  createBlockSchema,
  cancelBlockSchema,
  availabilityQuerySchema,
  rateRuleSchema,
  rateRuleIdSchema,
  counterStayQuoteSchema,
} from './schemas'
import { addRoom, editRoom, setRoomActive, setOperationalStatus } from './services/rooms.service'
import { addCategory, editCategory, setCategoryActive } from './services/categories.service'
import { addBlock, cancelBlock } from './services/blocks.service'
import { checkAvailability } from './services/availability.service'
import {
  addRateRule,
  editRateRule,
  removeRateRule,
  quoteStayForCounter,
} from './services/rates.service'

export const createRoomAction = createAction(roomSchema, async (input) => {
  await addRoom(input)
  revalidatePath('/dashboard/acomodacoes')
  return { ok: true as const }
})

export const updateRoomAction = createAction(roomSchema.and(roomIdSchema), async (input) => {
  await editRoom(input.id, input)
  revalidatePath('/dashboard/acomodacoes')
  return { ok: true as const }
})

export const setRoomStatusAction = createAction(roomStatusSchema, async ({ id, status }) => {
  await setRoomActive(id, status === 'active')
  revalidatePath('/dashboard/acomodacoes')
  return { id }
})

export const setRoomOperationalStatusAction = createAction(
  roomOperationalStatusSchema,
  async ({ id, status }) => {
    await setOperationalStatus(id, status)
    revalidatePath('/dashboard/acomodacoes')
    return { id }
  },
)

export const createCategoryAction = createAction(categorySchema, async (input) => {
  await addCategory(input)
  revalidatePath('/dashboard/acomodacoes/categorias')
  return { ok: true as const }
})

export const updateCategoryAction = createAction(
  categorySchema.and(categoryIdSchema),
  async (input) => {
    await editCategory(input.id, input)
    revalidatePath('/dashboard/acomodacoes/categorias')
    return { ok: true as const }
  },
)

export const setCategoryStatusAction = createAction(
  categoryIdSchema.and(roomStatusSchema.pick({ status: true })),
  async ({ id, status }) => {
    await setCategoryActive(id, status === 'active')
    revalidatePath('/dashboard/acomodacoes/categorias')
    return { id }
  },
)

export const createBlockAction = createAction(createBlockSchema, async (input) => {
  await addBlock(input)
  revalidatePath('/dashboard/acomodacoes/bloqueios')
  return { ok: true as const }
})

export const cancelBlockAction = createAction(cancelBlockSchema, async (input) => {
  await cancelBlock(input.id, input.cancellationReason)
  revalidatePath('/dashboard/acomodacoes/bloqueios')
  return { ok: true as const }
})

export const checkAvailabilityAction = createAction(availabilityQuerySchema, async (input) => {
  return checkAvailability(input)
})

// Tarifas por temporada (0087). O preço muda a vitrine e a reserva pública.
function revalidateRates() {
  revalidatePath('/dashboard/acomodacoes/tarifas')
}

export const createRateRuleAction = createAction(rateRuleSchema, async (input) => {
  const { id } = await addRateRule(input)
  revalidateRates()
  return { id }
})

export const updateRateRuleAction = createAction(
  rateRuleSchema.and(rateRuleIdSchema),
  async (input) => {
    await editRateRule(input.id, input)
    revalidateRates()
    return { id: input.id }
  },
)

export const deleteRateRuleAction = createAction(rateRuleIdSchema, async ({ id }) => {
  await removeRateRule(id)
  revalidateRates()
  return { id }
})

export const quoteCounterStayAction = createAction(counterStayQuoteSchema, async (input) => {
  return quoteStayForCounter(input)
})
