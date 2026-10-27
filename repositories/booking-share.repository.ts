import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { BookingStatus } from '@/features/reservas/types'
import { listMyBookingRows } from './bookings.repository'

/**
 * Agenda (.ics) e link para o acompanhante (h9, 0094).
 *
 * Posse da reserva: sempre do banco. `list_my_bookings` só devolve reservas do
 * usuário logado; `share_my_booking`/`revoke_my_booking_share` conferem de novo
 * (`bookings.guest_id = auth.uid()`), então chamar a RPC direto pela API REST
 * com a reserva de outra pessoa dá "Reserva não encontrada.".
 */

export type MyBookingTrip = {
  id: string
  code: string
  status: BookingStatus
  paymentDueAt: string | null
  checkin: string
  checkout: string
  pousadaName: string
  address: string
  cep: string
  city: string
  state: string
  checkinTime: string
  checkoutTime: string
  timeZone: string
}

/** Reserva do usuário logado + colunas públicas da pousada. `null` = não é dele. */
export async function getMyBookingTrip(bookingId: string): Promise<MyBookingTrip | null> {
  const [row] = await listMyBookingRows(bookingId)
  if (!row) return null
  const supabase = await createSupabaseServerClient()
  const { data: p, error } = await supabase
    .from('pousadas')
    .select('name, address, cep, city, state, checkin_time, checkout_time, timezone')
    .eq('id', row.pousada_id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return {
    id: row.id,
    code: row.code,
    status: row.status as BookingStatus,
    paymentDueAt: row.payment_due_at ?? null,
    checkin: row.checkin,
    checkout: row.checkout,
    pousadaName: p?.name ?? 'Pousada',
    address: p?.address ?? '',
    cep: p?.cep ?? '',
    city: p?.city ?? '',
    state: p?.state ?? '',
    checkinTime: p?.checkin_time ?? '',
    checkoutTime: p?.checkout_time ?? '',
    timeZone: p?.timezone ?? '',
  }
}

/** Token do link (o atual, ou um novo com `renew`). */
export async function shareMyBookingRpc(bookingId: string, renew: boolean): Promise<string> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('share_my_booking', {
    p_booking_id: bookingId,
    p_renew: renew,
  })
  if (error) throw new Error(error.message)
  if (typeof data !== 'string') throw new Error('Não foi possível criar o link.')
  return data
}

export async function revokeMyBookingShareRpc(bookingId: string): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc('revoke_my_booking_share', { p_booking_id: bookingId })
  if (error) throw new Error(error.message)
}

/** Leitura pública do link (anon). Devolve o JSON cru; quem interpreta é `parseSharedTrip`. */
export async function getSharedBookingRpc(token: string): Promise<unknown> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('get_shared_booking', { p_token: token })
  if (error) throw new Error(error.message)
  return data
}
