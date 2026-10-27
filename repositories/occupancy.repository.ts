import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { OccupancyBooking, OccupancyHold, OccupancyRoom } from '@/features/gestao/occupancy'
import type { BookingOrigin, BookingStatus } from '@/features/reservas/types'

/**
 * Leituras do mapa de ocupação (/dashboard/reservas/ocupacao) e a RPC de mover
 * reserva (0096). Tudo com o cliente do usuário: a RLS de `bookings`,
 * `room_blocks`, `rooms` e `channel_events` é a segunda barreira.
 */

/** Reservas que aparecem no mapa: as que ocupam o quarto e as concluídas (histórico da janela). */
const VISIBLE: BookingStatus[] = ['pending', 'confirmed', 'checked_in', 'checked_out']

const CHANNEL_LABEL: Record<string, string> = {
  airbnb: 'Airbnb',
  booking: 'Booking.com',
  outro: 'Outro canal',
}

export async function listOccupancyRooms(pousadaId: string): Promise<OccupancyRoom[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('rooms')
    .select('id, name, capacity, capacity_max, pets_allowed, operational_status')
    .eq('pousada_id', pousadaId)
    .eq('status', 'active')
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    capacity: Number(r.capacity_max ?? r.capacity ?? 0),
    petsAllowed: Boolean(r.pets_allowed),
    unavailable: r.operational_status === 'maintenance' || r.operational_status === 'blocked',
  }))
}

/** Reservas que tocam a janela [from, to). */
export async function listOccupancyBookings(
  pousadaId: string,
  from: string,
  to: string,
): Promise<OccupancyBooking[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('bookings')
    .select(
      'id, code, room_id, guest_name, checkin, checkout, status, origin, adults, children, pets, subtotal, total, amount_received, version',
    )
    .eq('pousada_id', pousadaId)
    .in('status', VISIBLE)
    .lt('checkin', to)
    .gt('checkout', from)
    .order('checkin', { ascending: true })
  if (error) throw error
  return (data ?? []).map((b) => ({
    id: b.id,
    code: b.code,
    roomId: b.room_id,
    guestName: b.guest_name?.trim() || 'Hóspede',
    checkin: b.checkin,
    checkout: b.checkout,
    status: b.status as BookingStatus,
    origin: b.origin as BookingOrigin,
    guests: (b.adults ?? 0) + (b.children ?? 0),
    pets: Boolean(b.pets),
    subtotal: Number(b.subtotal),
    total: Number(b.total),
    amountReceived: Number(b.amount_received ?? 0),
    version: b.version,
  }))
}

function utcDate(ts: string): string {
  return new Date(ts).toISOString().slice(0, 10)
}

/** Fim de bloqueio no meio do dia ainda ocupa aquela noite (mesma sobreposição da RPC). */
function utcDateCeil(ts: string): string {
  const d = new Date(ts)
  if (d.getUTCHours() || d.getUTCMinutes() || d.getUTCSeconds() || d.getUTCMilliseconds()) {
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return d.toISOString().slice(0, 10)
}

/** Bloqueios ativos e noites vendidas nos canais (iCal) que tocam a janela. */
export async function listOccupancyHolds(
  pousadaId: string,
  from: string,
  to: string,
): Promise<OccupancyHold[]> {
  const supabase = await createSupabaseServerClient()
  const [blocks, events] = await Promise.all([
    supabase
      .from('room_blocks')
      .select('id, room_id, starts_at, ends_at, reason')
      .eq('pousada_id', pousadaId)
      .eq('status', 'active')
      .lt('starts_at', `${to}T00:00:00Z`)
      .gt('ends_at', `${from}T00:00:00Z`),
    supabase
      .from('channel_events')
      .select('id, room_id, starts_on, ends_on, channel_calendars(provider)')
      .eq('pousada_id', pousadaId)
      .lt('starts_on', to)
      .gt('ends_on', from),
  ])
  if (blocks.error) throw blocks.error
  // Quem não lê canais (RLS) simplesmente não vê as faixas; o banco continua
  // barrando a mudança por cima delas.
  const eventRows = events.error ? [] : (events.data ?? [])

  const out: OccupancyHold[] = (blocks.data ?? []).map((b) => ({
    id: b.id,
    roomId: b.room_id,
    startsOn: utcDate(b.starts_at),
    endsOn: utcDateCeil(b.ends_at),
    kind: 'block',
    label: b.reason?.trim() || 'Bloqueado',
  }))
  for (const e of eventRows) {
    const cal = e.channel_calendars as { provider: string } | { provider: string }[] | null
    const provider = Array.isArray(cal) ? cal[0]?.provider : cal?.provider
    out.push({
      id: e.id,
      roomId: e.room_id,
      startsOn: e.starts_on,
      endsOn: e.ends_on,
      kind: 'channel',
      label: CHANNEL_LABEL[provider ?? ''] ?? 'Canal',
    })
  }
  return out
}

export type MoveBookingParams = {
  bookingId: string
  version: number
  roomId: string
  checkin: string
  checkout: string
  reprice: boolean
}

export type MoveBookingResult = {
  id: string
  version: number
  roomId: string
  checkin: string
  checkout: string
  previousTotal: number
  total: number
}

export async function moveBookingRpc(p: MoveBookingParams): Promise<MoveBookingResult> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('move_booking', {
    p_booking_id: p.bookingId,
    p_version: p.version,
    p_room_id: p.roomId,
    p_checkin: p.checkin,
    p_checkout: p.checkout,
    p_reprice: p.reprice,
  })
  if (error) throw new Error(error.message)
  return data as unknown as MoveBookingResult
}
