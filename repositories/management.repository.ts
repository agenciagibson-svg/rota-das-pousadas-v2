import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { setBookingStatusRpc } from '@/repositories/bookings.repository'
import {
  blockCalendarDay,
  unblockCalendarDay,
  listBlockedCalendarDays,
  listBlockedCalendarDaysByPousada,
} from '@/repositories/room-blocks.repository'
import { nightsBetween } from '@/features/reservas/pricing'
import type { BookingStatus } from '@/features/reservas/types'
import type {
  ManagedPousada,
  OwnerPousadaSettings,
  OwnerReservation,
} from '@/features/gestao/types'

const OCCUPYING: BookingStatus[] = ['pending', 'confirmed', 'checked_in']

export async function getManagedPousada(pousadaId: string): Promise<ManagedPousada | null> {
  const supabase = await createSupabaseServerClient()
  const { data: p, error } = await supabase
    .from('pousadas')
    .select('id, slug, name, status, timezone')
    .eq('id', pousadaId)
    .maybeSingle()
  if (error) throw error
  if (!p) return null

  const { data: room } = await supabase
    .from('rooms')
    .select('id')
    .eq('pousada_id', pousadaId)
    .order('base_price', { ascending: true })
    .limit(1)
    .maybeSingle()

  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    status: p.status,
    roomId: room?.id ?? '',
    timezone: p.timezone,
  }
}

export async function getPousadaSettings(pousadaId: string): Promise<OwnerPousadaSettings | null> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('pousadas')
    .select(
      'id, slug, name, legal_name, tax_id, city, state, country, address, cep, image, gallery, description, tags, timezone, currency, language, checkin_time, checkout_time, contact_phone, whatsapp, notification_email, house_rules, cancellation_policy',
    )
    .eq('id', pousadaId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null

  return {
    id: data.id,
    slug: data.slug,
    name: data.name,
    legalName: data.legal_name,
    taxId: data.tax_id,
    city: data.city,
    state: data.state,
    country: data.country,
    address: data.address,
    cep: data.cep,
    image: data.image,
    gallery: data.gallery ?? [],
    description: data.description,
    tags: data.tags,
    timezone: data.timezone,
    currency: data.currency,
    language: data.language,
    checkinTime: data.checkin_time,
    checkoutTime: data.checkout_time,
    contactPhone: data.contact_phone,
    whatsapp: data.whatsapp,
    notificationEmail: data.notification_email,
    houseRules: data.house_rules,
    cancellationPolicy: data.cancellation_policy,
  }
}

export type UpdatePousadaSettingsRow = {
  name: string
  legalName: string
  taxId: string
  city: string
  state: string
  country: string
  address: string
  cep: string
  image: string
  gallery: string[]
  description: string
  tags: string[]
  timezone: string
  currency: string
  language: string
  checkinTime: string
  checkoutTime: string
  contactPhone: string
  whatsapp: string
  notificationEmail: string
  houseRules: string
  cancellationPolicy: string
}

export async function updatePousadaSettings(
  pousadaId: string,
  input: UpdatePousadaSettingsRow,
): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase
    .from('pousadas')
    .update({
      name: input.name,
      legal_name: input.legalName,
      tax_id: input.taxId,
      city: input.city,
      state: input.state,
      country: input.country,
      address: input.address,
      cep: input.cep,
      image: input.image,
      gallery: input.gallery,
      description: input.description,
      tags: input.tags,
      timezone: input.timezone,
      currency: input.currency,
      language: input.language,
      checkin_time: input.checkinTime,
      checkout_time: input.checkoutTime,
      contact_phone: input.contactPhone,
      whatsapp: input.whatsapp,
      notification_email: input.notificationEmail,
      house_rules: input.houseRules,
      cancellation_policy: input.cancellationPolicy,
    })
    .eq('id', pousadaId)
  if (error) throw error
}

/**
 * [Ciclo 4] Filtros/colunas novas (origem, saldo, "atenções"). "Atenção" é
 * calculada aqui mesmo (pending vencida sem pagamento) — nunca altera status
 * sozinha (RB seção 9: expiração automática silenciosa foi removida; agora
 * só acontece via ação explícita e auditada — ver `expire_pending_booking`,
 * chamada pela tela de detalhe da reserva).
 */
export async function listReservationsByPousada(
  pousadaId: string,
  filters: {
    status?: BookingStatus
    origin?: string
    roomId?: string
    guestName?: string
    pendingPaymentOnly?: boolean
    checkinFrom?: string
    checkinTo?: string
  } = {},
): Promise<OwnerReservation[]> {
  const supabase = await createSupabaseServerClient()
  let query = supabase
    .from('bookings')
    .select(
      'id, code, guest_name, guest_email, guest_phone, responsible_guest_id, room_id, checkin, checkout, guests, subtotal, fee, total, balance_due, status, origin, payment_due_at, created_at',
    )
    .eq('pousada_id', pousadaId)
    .order('checkin', { ascending: true })

  if (filters.status) query = query.eq('status', filters.status)
  if (filters.origin) query = query.eq('origin', filters.origin)
  if (filters.roomId) query = query.eq('room_id', filters.roomId)
  if (filters.guestName) query = query.ilike('guest_name', `%${filters.guestName}%`)
  if (filters.pendingPaymentOnly) query = query.eq('status', 'pending')
  if (filters.checkinFrom) query = query.gte('checkin', filters.checkinFrom)
  if (filters.checkinTo) query = query.lte('checkin', filters.checkinTo)

  const { data, error } = await query
  if (error) throw error

  const roomIds = [...new Set((data ?? []).map((r) => r.room_id))]
  const { data: rooms } = roomIds.length
    ? await supabase.from('rooms').select('id, name').in('id', roomIds)
    : { data: [] }
  const roomById = new Map((rooms ?? []).map((room) => [room.id, room]))

  // Telefone: o da reserva ou, se vazio, o WhatsApp/telefone da ficha do hóspede.
  const guestIds = [
    ...new Set((data ?? []).filter((r) => !r.guest_phone).map((r) => r.responsible_guest_id)),
  ].filter(Boolean) as string[]
  const { data: guestRows } = guestIds.length
    ? await supabase.from('guests').select('id, phone, whatsapp').in('id', guestIds)
    : { data: [] }
  const guestPhoneById = new Map(
    (guestRows ?? []).map((g) => [g.id, (g.whatsapp || g.phone || null) as string | null]),
  )

  const now = new Date().toISOString()
  return (data ?? []).map((r) => ({
    id: r.id,
    code: r.code,
    guestName: r.guest_name ?? 'Hóspede',
    guestEmail: r.guest_email ?? 'E-mail não informado',
    guestPhone: r.guest_phone || guestPhoneById.get(r.responsible_guest_id) || null,
    roomName: roomById.get(r.room_id)?.name ?? 'Acomodação',
    checkin: r.checkin,
    checkout: r.checkout,
    nights: nightsBetween(r.checkin, r.checkout),
    guests: r.guests,
    subtotal: Number(r.subtotal),
    fee: Number(r.fee),
    total: Number(r.total),
    balanceDue: Number(r.balance_due),
    status: r.status as BookingStatus,
    origin: r.origin as OwnerReservation['origin'],
    paymentDueAt: r.payment_due_at,
    createdAt: r.created_at,
    needsAttention: r.status === 'pending' && !!r.payment_due_at && r.payment_due_at < now,
  }))
}

/** [Ciclo 4] Confirmar/cancelar/no-show passam a chamar a RPC transacional (set_booking_status) — nunca `.update()` direto. */
export async function updateReservationStatusByPousada(
  pousadaId: string,
  bookingId: string,
  status: BookingStatus,
  reason?: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { data, error: fetchError } = await supabase
    .from('bookings')
    .select('id')
    .eq('id', bookingId)
    .eq('pousada_id', pousadaId)
    .maybeSingle()
  if (fetchError) throw fetchError
  if (!data) throw new Error('Reserva não encontrada nesta pousada.')
  await setBookingStatusRpc(bookingId, status, reason)
}

export async function listBookingRanges(
  pousadaId: string,
): Promise<{ roomId: string; checkin: string; checkout: string }[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('bookings')
    .select('room_id, checkin, checkout')
    .eq('pousada_id', pousadaId)
    .in('status', OCCUPYING)
  if (error) throw error
  return (data ?? []).map((r) => ({ roomId: r.room_id, checkin: r.checkin, checkout: r.checkout }))
}

/** Quartos ativos da pousada (calendário por quarto). */
export async function listActiveRoomsByPousada(
  pousadaId: string,
): Promise<{ id: string; name: string }[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('rooms')
    .select('id, name')
    .eq('pousada_id', pousadaId)
    .eq('status', 'active')
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []).map((r) => ({ id: r.id, name: r.name }))
}

/** Dias bloqueados (bloqueios ativos) de todos os quartos da pousada. */
export async function listBlockedDaysByPousada(
  pousadaId: string,
): Promise<{ roomId: string; date: string }[]> {
  return listBlockedCalendarDaysByPousada(pousadaId)
}

/**
 * [Ciclo 3B] `availability` deixou de ser a fonte de bloqueios (0 linhas
 * reais no momento da unificação — ver 0026_room_read_scope_and_calendar_compat.sql).
 * O calendário do proprietário agora lê/grava em `room_blocks`, a mesma
 * fonte canônica da tela de Bloqueios do Ciclo 3 — um bloqueio criado aqui
 * aparece lá e vice-versa; cancelar em um reflete no outro.
 */
export async function listBlockedDates(roomId: string): Promise<string[]> {
  return listBlockedCalendarDays(roomId)
}

export async function blockDate(pousadaId: string, roomId: string, date: string): Promise<void> {
  await blockCalendarDay(pousadaId, roomId, date)
}

export async function unblockDate(pousadaId: string, roomId: string, date: string): Promise<void> {
  await unblockCalendarDay(pousadaId, roomId, date)
}
