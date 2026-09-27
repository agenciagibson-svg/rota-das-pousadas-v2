'use server'

import { revalidatePath } from 'next/cache'
import type { ZodType, z } from 'zod'
import { createAction } from '@/actions/create-action'
import {
  chargeSchema,
  consumptionPaymentSchema,
  guestSettingsSchema,
  orderStatusSchema,
} from './schemas'
import {
  changeOrderStatus,
  chargeConsumption,
  registerConsumptionPayment,
  saveOwnerGuestSettings,
} from './services/orders.service'

export const setOrderStatusAction = createAction(orderStatusSchema, async (input) => {
  if (input.status === 'cancelado' && (!input.reason || input.reason.length < 3)) {
    throw new Error('Informe o motivo do cancelamento.')
  }
  await changeOrderStatus(input.orderId, input.status, input.reason ?? null)
  revalidatePath('/dashboard/pedidos')
  revalidatePath('/dashboard/estoque')
  return { ok: true as const }
})

export const chargeConsumptionAction = createAction(chargeSchema, async (raw) => {
  const input = chargeSchema.parse(raw)
  const res = await chargeConsumption(input.bookingId, input.items, input.note)
  revalidatePath('/dashboard/pedidos')
  revalidatePath('/dashboard/estoque')
  revalidatePath(`/dashboard/reservas/${input.bookingId}`)
  return res
})

export const registerConsumptionPaymentAction = createAction(
  consumptionPaymentSchema,
  async (raw) => {
    const input = consumptionPaymentSchema.parse(raw)
    await registerConsumptionPayment(input.bookingId, input.amount, input.method, input.note)
    revalidatePath(`/dashboard/reservas/${input.bookingId}`)
    revalidatePath('/dashboard/financeiro')
    return { ok: true as const }
  },
)

// O schema transforma as listas (texto → JSON). createAction já valida e entrega
// o resultado transformado — não validar de novo (as listas já viraram arrays).
const guestSettingsInput: ZodType<unknown> = guestSettingsSchema
export const saveGuestSettingsAction = createAction(guestSettingsInput, async (parsed) => {
  const input = parsed as z.output<typeof guestSettingsSchema>
  await saveOwnerGuestSettings(input)
  revalidatePath('/dashboard/configuracoes')
  return { ok: true as const }
})
