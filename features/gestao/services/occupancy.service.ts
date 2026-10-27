import 'server-only'
import { requireCapability } from '@/lib/auth/require-capability'
import { addDaysToISODate, DEFAULT_TIMEZONE, isoDateInTimeZone } from '@/lib/dates'
import { getManagedPousada } from '@/repositories/management.repository'
import { getBookingPousadaId } from '@/repositories/bookings.repository'
import {
  listOccupancyBookings,
  listOccupancyHolds,
  listOccupancyRooms,
  moveBookingRpc,
  type MoveBookingResult,
} from '@/repositories/occupancy.repository'
import { resolveWindow, type OccupancyBoard } from '@/features/gestao/occupancy'
import type { MoveBookingInput } from '@/features/gestao/schemas'

/**
 * Mapa de ocupação da pousada ativa. Só para quem gerencia reservas
 * (`booking:manage`): o financeiro abre a lista, não o mapa.
 */
export async function getOccupancyBoard(params: {
  inicio?: string
  dias?: string
}): Promise<OccupancyBoard> {
  const { pousadaId } = await requireCapability('booking:manage')
  const pousada = await getManagedPousada(pousadaId)
  const today = isoDateInTimeZone(new Date(), pousada?.timezone || DEFAULT_TIMEZONE)
  const { from, days } = resolveWindow(today, params)
  const to = addDaysToISODate(from, days)
  const [rooms, bookings, holds] = await Promise.all([
    listOccupancyRooms(pousadaId),
    listOccupancyBookings(pousadaId, from, to),
    listOccupancyHolds(pousadaId, from, to),
  ])
  return { rooms, bookings, holds, from, days, today }
}

/**
 * Move a reserva (quarto e/ou datas). O papel é conferido na pousada ATIVA e a
 * reserva precisa ser dela — quem tem `booking:manage` na pousada A não move
 * reserva da B mandando o id. A RPC `move_booking` repete as duas checagens e
 * aplica as regras de status, canal, disponibilidade e valor.
 */
export async function moveOwnerBooking(input: MoveBookingInput): Promise<MoveBookingResult> {
  const { pousadaId } = await requireCapability('booking:manage')
  if ((await getBookingPousadaId(input.bookingId)) !== pousadaId) {
    throw new Error('Reserva não encontrada nesta pousada.')
  }
  return moveBookingRpc({
    bookingId: input.bookingId,
    version: input.version,
    roomId: input.roomId,
    checkin: input.checkin,
    checkout: input.checkout,
    reprice: input.reprice,
  })
}
