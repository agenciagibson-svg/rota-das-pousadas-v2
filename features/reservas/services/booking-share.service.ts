import 'server-only'
import { getCurrentUser } from '@/features/auth/services/auth.service'
import { isSupabaseConfigured, publicEnv } from '@/lib/env'
import {
  getMyBookingTrip,
  getSharedBookingRpc,
  revokeMyBookingShareRpc,
  shareMyBookingRpc,
} from '@/repositories/booking-share.repository'
import { buildBookingIcs, icsFileName } from '../ics'
import {
  isShareToken,
  parseSharedTrip,
  sharedTripPath,
  tripMapsUrl,
  type SharedTrip,
} from '../share'

/** Reserva que não segura mais as datas: cancelada, não compareceu ou pendência vencida. */
function isInactive(trip: { status: string; paymentDueAt: string | null }, now: Date): boolean {
  if (trip.status === 'cancelled' || trip.status === 'no_show') return true
  return (
    trip.status === 'pending' &&
    Boolean(trip.paymentDueAt) &&
    new Date(trip.paymentDueAt as string).getTime() <= now.getTime()
  )
}

/**
 * Arquivo .ics da reserva do hóspede logado. `null` = sem login, reserva de
 * outra pessoa ou inexistente (a rota responde 404 nos três casos).
 */
export async function getMyBookingCalendarFile(
  bookingId: string,
  now: Date = new Date(),
): Promise<{ fileName: string; content: string } | null> {
  if (!isSupabaseConfigured()) return null
  const user = await getCurrentUser()
  if (!user) return null
  const trip = await getMyBookingTrip(bookingId)
  if (!trip) return null

  const content = buildBookingIcs({
    bookingId: trip.id,
    code: trip.code,
    pousadaName: trip.pousadaName,
    address: trip.address,
    cep: trip.cep,
    city: trip.city,
    state: trip.state,
    checkin: trip.checkin,
    checkout: trip.checkout,
    checkinTime: trip.checkinTime,
    checkoutTime: trip.checkoutTime,
    timeZone: trip.timeZone,
    status: isInactive(trip, now)
      ? 'cancelled'
      : trip.status === 'pending'
        ? 'tentative'
        : 'confirmed',
    detailsUrl: `${publicEnv.siteUrl}/minhas-reservas`,
    mapsUrl: tripMapsUrl(trip),
    uidDomain: new URL(publicEnv.siteUrl).hostname,
    now,
  })
  return { fileName: icsFileName(trip.code), content }
}

/** Link para o acompanhante: o atual, ou um novo (`renew`, o antigo para de abrir). */
export async function shareMyBooking(bookingId: string, renew: boolean): Promise<{ url: string }> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Faça login para compartilhar a reserva.')
  const token = await shareMyBookingRpc(bookingId, renew)
  return { url: `${publicEnv.siteUrl}${sharedTripPath(token)}` }
}

export async function revokeMyBookingShare(bookingId: string): Promise<void> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Faça login para desativar o link.')
  await revokeMyBookingShareRpc(bookingId)
}

/** Página pública do link. `null` = token inválido, revogado ou inexistente. */
export async function getSharedTrip(token: string): Promise<SharedTrip | null> {
  if (!isShareToken(token) || !isSupabaseConfigured()) return null
  return parseSharedTrip(await getSharedBookingRpc(token))
}
