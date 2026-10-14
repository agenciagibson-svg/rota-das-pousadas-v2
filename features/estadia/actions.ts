'use server'

import { revalidatePath } from 'next/cache'
import { createAction } from '@/actions/create-action'
import { cancelOrderSchema, placeOrderSchema, reviewSchema } from '@/features/pedidos/schemas'
import { cancelOrder, placeOrder, submitReview } from './services/stay.service'

export const placeGuestOrderAction = createAction(placeOrderSchema, async (input) => {
  const res = await placeOrder(input.bookingId, input.items, input.note)
  revalidatePath(`/estadia/${input.bookingId}`)
  revalidatePath('/dashboard/pedidos')
  return res
})

export const cancelGuestOrderAction = createAction(cancelOrderSchema, async (input) => {
  await cancelOrder(input.orderId)
  revalidatePath('/dashboard/pedidos')
  return { ok: true as const }
})

export const submitStayReviewAction = createAction(reviewSchema, async (input) => {
  await submitReview(input.bookingId, input.rating, input.text)
  revalidatePath(`/estadia/${input.bookingId}`)
  revalidatePath('/dashboard/avaliacoes')
  return { ok: true as const }
})
