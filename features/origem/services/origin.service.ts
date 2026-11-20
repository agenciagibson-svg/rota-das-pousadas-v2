import 'server-only'
import { cookies } from 'next/headers'
import { can } from '@/lib/auth/rbac'
import { getCurrentUser } from '@/features/auth/services/auth.service'
import { reportError } from '@/lib/observability/report-error'
import {
  bookingOriginsById,
  listPlatformBookingChannelsRpc,
  recordBookingAttributionRpc,
  type BookingVisitOrigin,
  type PlatformChannels,
} from '@/repositories/attribution.repository'
import { ORIGIN_COOKIE, decodeOrigin } from '../origin'

/**
 * Grava a origem da reserva que o viajante acabou de criar, a partir do
 * cookie da visita. Nunca derruba a reserva: se falhar, a reserva segue e o
 * erro vai para o monitoramento.
 */
export async function recordOriginForNewBooking(bookingId: string): Promise<void> {
  try {
    const jar = await cookies()
    const origin = decodeOrigin(jar.get(ORIGIN_COOKIE)?.value)
    await recordBookingAttributionRpc(bookingId, origin)
  } catch (error) {
    await reportError(error, { where: 'origem.recordOriginForNewBooking', tags: { bookingId } })
  }
}

/** Origem das reservas para o painel da pousada. Sem acesso ou erro: mapa vazio. */
export async function getBookingOrigins(
  bookingIds: string[],
): Promise<Map<string, BookingVisitOrigin>> {
  try {
    return await bookingOriginsById(bookingIds)
  } catch (error) {
    await reportError(error, { where: 'origem.getBookingOrigins' })
    return new Map()
  }
}

/**
 * /admin → Relatórios: reservas feitas pelo site por canal. Primeira barreira
 * aqui (`reports:global:view`); a segunda é a RPC (equipe da plataforma).
 */
export async function getPlatformBookingChannels(month: string | null): Promise<PlatformChannels> {
  const user = await getCurrentUser()
  if (!user?.platformRole || !can(user.platformRole, 'reports:global:view')) {
    throw new Error('Você não tem permissão para ver relatórios.')
  }
  return listPlatformBookingChannelsRpc(month)
}
