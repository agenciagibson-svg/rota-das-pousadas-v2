'use server'

import { revalidatePath } from 'next/cache'
import { createAction } from '@/actions/create-action'
import {
  bookingIdActionSchema,
  dateActionSchema,
  pousadaSettingsSchema,
  reservationStatusActionSchema,
  reviewResponseActionSchema,
} from './schemas'
import {
  blockOwnerDate,
  expireOwnerPendingBooking,
  respondOwnerReview,
  unblockOwnerDate,
  updateOwnerSettings,
  updateOwnerReservationStatus,
} from './services/pms.service'

export const blockDateAction = createAction(dateActionSchema, async (input) => {
  const { affected } = await blockOwnerDate(input.date, input.roomId)
  revalidatePath('/dashboard/reservas')
  return { date: input.date, affected }
})

export const unblockDateAction = createAction(dateActionSchema, async (input) => {
  const { affected } = await unblockOwnerDate(input.date, input.roomId)
  revalidatePath('/dashboard/reservas')
  return { date: input.date, affected }
})

export const updateReservationStatusAction = createAction(
  reservationStatusActionSchema,
  async (input) => {
    await updateOwnerReservationStatus(input.bookingId, input.status, input.reason)
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/reservas')
    revalidatePath(`/dashboard/reservas/${input.bookingId}`)
    revalidatePath('/minhas-reservas')
    return { bookingId: input.bookingId, status: input.status }
  },
)

export const expireOwnerPendingBookingAction = createAction(
  bookingIdActionSchema,
  async (input) => {
    await expireOwnerPendingBooking(input.bookingId)
    revalidatePath('/dashboard/reservas')
    revalidatePath(`/dashboard/reservas/${input.bookingId}`)
    return { bookingId: input.bookingId }
  },
)

export const respondReviewAction = createAction(reviewResponseActionSchema, async (input) => {
  await respondOwnerReview(input.reviewId, input.response)
  revalidatePath('/dashboard/avaliacoes')
  return { reviewId: input.reviewId }
})

export const updatePousadaSettingsAction = createAction(pousadaSettingsSchema, async (input) => {
  await updateOwnerSettings(input)
  revalidatePath('/')
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/configuracoes')
  // Vitrine da pousada (fotos, descrição, regras) nas duas rotas públicas.
  revalidatePath('/pousada/[slug]', 'page')
  revalidatePath('/[slug]', 'page')
  return { ok: true as const }
})
