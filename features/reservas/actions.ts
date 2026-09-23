'use server'

import { revalidatePath } from 'next/cache'
import { createAction } from '@/actions/create-action'
import {
  cancelBookingSchema,
  createBookingAdminSchema,
  createBookingSchema,
  setBookingCompanionsSchema,
  updateBookingSchema,
} from './schemas'
import { cancelMyBooking, createAdminBooking, createBooking } from './services/bookings.service'
import {
  addChargeSchema,
  cancelChargeSchema,
  registerPaymentSchema,
  reversePaymentSchema,
} from './folio-schemas'
import { addCharge, cancelCharge, registerPayment, reversePayment } from './services/folio.service'
import { updateBookingRpc, setBookingCompanionsRpc } from '@/repositories/bookings.repository'
import { requireCapability } from '@/features/acomodacoes/services/access'
import { calculateBookingPrice } from './pricing'

/**
 * Cria uma reserva. Valida por Zod (createAction), delega a regra ao Service e
 * retorna `ActionResult`. A navegação pós-sucesso é feita no cliente.
 */
export const createBookingAction = createAction(createBookingSchema, async (input) => {
  const { id, code } = await createBooking(input)
  revalidatePath('/minhas-reservas')
  return { code, redirectTo: `/pousada/${input.pousadaSlug}/reservar/${id}/pagamento` }
})

/** Cancela uma reserva pendente do hóspede autenticado. */
export const cancelBookingAction = createAction(cancelBookingSchema, async (input) => {
  await cancelMyBooking(input.bookingId)
  revalidatePath('/minhas-reservas')
  return { ok: true as const }
})

/** Criação administrativa — recepção/proprietário/admin (booking:manage). */
export const createBookingAdminAction = createAction(createBookingAdminSchema, async (input) => {
  const { id, code } = await createAdminBooking(input)
  revalidatePath('/dashboard/reservas')
  return { id, code }
})

/** Edição administrativa — sempre com `version` (concorrência otimista, ver 0034). */
export const updateBookingAction = createAction(updateBookingSchema, async (input) => {
  await requireCapability('booking:manage')
  const price = calculateBookingPrice(input.nightlyRate, input.checkin, input.checkout, {
    discount: input.discount,
    surcharge: input.surcharge,
    servicesAmount: input.servicesAmount,
  })
  const result = await updateBookingRpc({
    bookingId: input.bookingId,
    version: input.version,
    roomId: input.roomId,
    responsibleGuestId: input.guestId,
    checkin: input.checkin,
    checkout: input.checkout,
    adults: input.adults,
    children: input.children,
    infants: input.infants,
    pets: input.pets,
    subtotal: price.subtotal,
    fee: price.fee,
    discount: price.discount,
    surcharge: price.surcharge,
    servicesAmount: price.servicesAmount,
    total: price.total,
    origin: input.origin,
    expectedArrivalTime: input.expectedArrivalTime || null,
    specialRequests: input.specialRequests || '',
    internalNotes: input.internalNotes || '',
  })
  revalidatePath(`/dashboard/reservas/${input.bookingId}`)
  revalidatePath('/dashboard/reservas')
  return { version: result.version }
})

export const setBookingCompanionsAction = createAction(
  setBookingCompanionsSchema,
  async (input) => {
    await requireCapability('booking:manage')
    const result = await setBookingCompanionsRpc(input.bookingId, input.version, input.companions)
    revalidatePath(`/dashboard/reservas/${input.bookingId}`)
    return { version: result.version }
  },
)

/** Telas que mostram saldo ou receita da reserva — recalculadas a cada lançamento da conta. */
function revalidateFolio(bookingId: string) {
  revalidatePath(`/dashboard/reservas/${bookingId}`)
  revalidatePath('/dashboard/reservas')
  revalidatePath('/dashboard/financeiro')
  revalidatePath('/dashboard')
}

/** Conta do hóspede (0069): consumo por pedido — `payment:register`. */
export const addBookingChargeAction = createAction(addChargeSchema, async (input) => {
  await addCharge(input)
  revalidateFolio(input.bookingId)
  return { ok: true as const }
})

/** Cancela consumo lançado por engano, com motivo — `payment:refund`. */
export const cancelBookingChargeAction = createAction(cancelChargeSchema, async (input) => {
  await cancelCharge(input)
  revalidateFolio(input.bookingId)
  return { ok: true as const }
})

/** Pagamento feito na pousada (dinheiro, PIX, cartão) — `payment:register`. */
export const registerManualPaymentAction = createAction(registerPaymentSchema, async (input) => {
  const result = await registerPayment(input)
  revalidateFolio(input.bookingId)
  return result
})

/** Estorna pagamento manual registrado por engano, com motivo — `payment:refund`. */
export const reverseManualPaymentAction = createAction(reversePaymentSchema, async (input) => {
  await reversePayment(input)
  revalidateFolio(input.bookingId)
  return { ok: true as const }
})
