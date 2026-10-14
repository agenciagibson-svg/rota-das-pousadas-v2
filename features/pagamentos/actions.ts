'use server'

import { z } from 'zod'
import { createAction } from '@/actions/create-action'
import { getConnectAuthorizationUrl } from './services/oauth.service'
import { startSubscriptionAuthorization } from './services/subscription.service'
import { revalidatePath } from 'next/cache'
import {
  resolvePaymentReview,
  reviewPaymentProof,
  saveOwnerPixSettings,
  submitPaymentProof,
} from './services/pix.service'
import { pixSettingsSchema, resolveReviewSchema, reviewProofSchema, submitProofSchema } from './pix'
import { registerBookingPaymentSchema, reverseBookingPaymentSchema } from './booking-payment'
import { registerBookingPayment, reverseBookingPayment } from './services/booking-payment.service'

/** Inicia a conexão OAuth com o Mercado Pago — só `payment:connect_account` (ver requireCapability). */
export const connectMercadoPagoAction = createAction(z.object({}), async () => {
  const url = await getConnectAuthorizationUrl()
  return { redirectTo: url }
})

/** Inicia a autorização da assinatura da plataforma — só `subscription:manage` (proprietario/master). */
export const startSubscriptionAuthorizationAction = createAction(z.object({}), async () => {
  const { initPoint } = await startSubscriptionAuthorization()
  return { redirectTo: initPoint }
})

/** Chave Pix da pousada (0075) — só o proprietário (`payment:connect_account`). */
export const savePixSettingsAction = createAction(pixSettingsSchema, async (input) => {
  await saveOwnerPixSettings(input)
  revalidatePath('/dashboard/configuracoes')
  return { ok: true as const }
})

/** Hóspede registra o comprovante já enviado ao Storage (a RPC confere dono, prazo e arquivo). */
export const submitPaymentProofAction = createAction(submitProofSchema, async (input) => {
  await submitPaymentProof(input)
  revalidatePath('/minhas-reservas')
  // O comprovante aparece na fila "Comprovantes Pix para aprovar" do painel.
  revalidatePath('/dashboard/reservas')
  revalidatePath('/dashboard')
  return { ok: true as const }
})

/** Equipe aprova ou recusa o comprovante (`payment:register`). */
export const reviewPaymentProofAction = createAction(reviewProofSchema, async (input) => {
  const { bookingId } = await reviewPaymentProof(input)
  revalidatePath(`/dashboard/reservas/${bookingId}`)
  revalidatePath('/dashboard/reservas')
  revalidatePath('/dashboard')
  revalidatePath('/minhas-reservas')
  return { ok: true as const }
})

/** Fecha um caso da fila "Pagamentos para revisar" com a anotação do que foi feito. */
export const resolvePaymentReviewAction = createAction(resolveReviewSchema, async (input) => {
  await resolvePaymentReview(input)
  revalidatePath('/dashboard')
  return { ok: true as const }
})

/** Equipe registra a diária recebida no balcão (`payment:register`, 0086). */
export const registerBookingPaymentAction = createAction(
  registerBookingPaymentSchema,
  async (input) => {
    const { bookingId } = await registerBookingPayment(input)
    revalidatePath(`/dashboard/reservas/${bookingId}`)
    revalidatePath('/dashboard/reservas')
    revalidatePath('/dashboard/financeiro')
    revalidatePath('/dashboard')
    revalidatePath('/minhas-reservas')
    return { ok: true as const }
  },
)

/** Estorno de lançamento manual da diária (`payment:refund`). */
export const reverseBookingPaymentAction = createAction(
  reverseBookingPaymentSchema,
  async (input) => {
    const { bookingId } = await reverseBookingPayment(input)
    revalidatePath(`/dashboard/reservas/${bookingId}`)
    revalidatePath('/dashboard/financeiro')
    revalidatePath('/minhas-reservas')
    return { ok: true as const }
  },
)
