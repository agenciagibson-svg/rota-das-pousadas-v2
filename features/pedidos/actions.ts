'use server'

import { revalidatePath } from 'next/cache'
import { createAction } from '@/actions/create-action'
import {
  chargeSchema,
  consumptionPaymentSchema,
  guestSettingsSchema,
  orderStatusSchema,
  reverseConsumptionPaymentSchema,
} from './schemas'
import {
  changeOrderStatus,
  chargeConsumption,
  registerConsumptionPayment,
  reverseConsumptionPayment,
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

export const chargeConsumptionAction = createAction(chargeSchema, async (input) => {
  const res = await chargeConsumption(input.bookingId, input.items, input.note)
  revalidatePath('/dashboard/pedidos')
  revalidatePath('/dashboard/estoque')
  revalidatePath(`/dashboard/reservas/${input.bookingId}`)
  return res
})

export const registerConsumptionPaymentAction = createAction(
  consumptionPaymentSchema,
  async (input) => {
    await registerConsumptionPayment(input.bookingId, input.amount, input.method, input.note)
    revalidatePath(`/dashboard/reservas/${input.bookingId}`)
    revalidatePath('/dashboard/financeiro')
    return { ok: true as const }
  },
)

export const reverseConsumptionPaymentAction = createAction(
  reverseConsumptionPaymentSchema,
  async (input) => {
    const { bookingId } = await reverseConsumptionPayment(input.paymentId, input.reason)
    revalidatePath(`/dashboard/reservas/${bookingId}`)
    revalidatePath('/dashboard/financeiro')
    return { ok: true as const }
  },
)

// O schema transforma as listas (texto → JSON); o handler já recebe o resultado.
export const saveGuestSettingsAction = createAction(guestSettingsSchema, async (input) => {
  await saveOwnerGuestSettings(input)
  revalidatePath('/dashboard/configuracoes')
  return { ok: true as const }
})
