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
import {
  cancelMyBooking,
  createAdminBooking,
  createBooking,
  setAdminBookingCompanions,
  updateAdminBooking,
} from './services/bookings.service'
import { submitMyPrecheckin } from './services/precheckin.service'
import { precheckinSchema, precheckinPath } from './precheckin'

/** A reserva do hóspede também muda o que a pousada vê no painel. */
function revalidatePanelBookings() {
  revalidatePath('/dashboard/reservas')
  revalidatePath('/dashboard')
}

/**
 * Cria uma reserva. Valida por Zod (createAction), delega a regra ao Service e
 * retorna `ActionResult`. A navegação pós-sucesso é feita no cliente.
 */
export const createBookingAction = createAction(createBookingSchema, async (input) => {
  const { id, code } = await createBooking(input)
  revalidatePath('/minhas-reservas')
  revalidatePanelBookings()
  return { code, redirectTo: `/pousada/${input.pousadaSlug}/reservar/${id}/pagamento` }
})

/** Cancela uma reserva pendente do hóspede autenticado. */
export const cancelBookingAction = createAction(cancelBookingSchema, async (input) => {
  await cancelMyBooking(input.bookingId)
  revalidatePath('/minhas-reservas')
  revalidatePanelBookings()
  return { ok: true as const }
})

/** Criação administrativa — recepção/proprietário/admin (booking:manage). */
export const createBookingAdminAction = createAction(createBookingAdminSchema, async (input) => {
  const { id, code } = await createAdminBooking(input)
  revalidatePath('/dashboard/reservas')
  return { id, code }
})

/** Edição administrativa — regra e autorização no Service (`updateAdminBooking`). */
export const updateBookingAction = createAction(updateBookingSchema, async (input) => {
  const result = await updateAdminBooking(input)
  revalidatePath(`/dashboard/reservas/${input.bookingId}`)
  revalidatePath('/dashboard/reservas')
  return { version: result.version }
})

/** Pré-check-in online (0088): o hóspede completa a ficha antes de chegar. */
export const submitPrecheckinAction = createAction(precheckinSchema, async (input) => {
  await submitMyPrecheckin(input)
  revalidatePath('/minhas-reservas')
  revalidatePath(precheckinPath(input.bookingId))
  revalidatePath(`/dashboard/reservas/${input.bookingId}`)
  revalidatePanelBookings()
  return { ok: true as const }
})

export const setBookingCompanionsAction = createAction(
  setBookingCompanionsSchema,
  async (input) => {
    const result = await setAdminBookingCompanions(input)
    revalidatePath(`/dashboard/reservas/${input.bookingId}`)
    return { version: result.version }
  },
)
