import 'server-only'
import { listMyBookingIdsAwaitingApproval } from './pix.repository'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service'
import { safeDecryptDocumentNumber } from '@/lib/crypto/document-cipher'
import { nightsBetween } from '@/features/reservas/pricing'
import type {
  Booking,
  BookingCompanion,
  BookingDetail,
  BookingOrigin,
  BookingStatus,
  FnrhData,
} from '@/features/reservas/types'

export type CreateBookingParams = {
  pousadaId: string
  roomId: string
  responsibleGuestId: string
  code: string
  checkin: string
  checkout: string
  adults: number
  children: number
  infants: number
  pets: boolean
  subtotal: number
  fee: number
  discount: number
  surcharge: number
  servicesAmount: number
  total: number
  status: BookingStatus
  origin: BookingOrigin
  travelerUserId?: string | null
  externalChannelName?: string | null
  externalCode?: string | null
  expectedCommission?: number | null
  expectedArrivalTime?: string | null
  specialRequests?: string
  internalNotes?: string
  paymentDueAt?: string | null
}

/** Única porta de criação de reserva — pública e administrativa (create_booking, 0034). */
export async function createBookingRpc(
  p: CreateBookingParams,
): Promise<{ id: string; code: string }> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('create_booking', {
    p_pousada_id: p.pousadaId,
    p_room_id: p.roomId,
    p_responsible_guest_id: p.responsibleGuestId,
    p_code: p.code,
    p_checkin: p.checkin,
    p_checkout: p.checkout,
    p_adults: p.adults,
    p_children: p.children,
    p_infants: p.infants,
    p_pets: p.pets,
    p_subtotal: p.subtotal,
    p_fee: p.fee,
    p_discount: p.discount,
    p_surcharge: p.surcharge,
    p_services_amount: p.servicesAmount,
    p_total: p.total,
    p_status: p.status,
    p_origin: p.origin,
    p_traveler_user_id: p.travelerUserId ?? null,
    p_external_channel_name: p.externalChannelName ?? null,
    p_external_code: p.externalCode ?? null,
    p_expected_commission: p.expectedCommission ?? null,
    p_expected_arrival_time: p.expectedArrivalTime ?? null,
    p_special_requests: p.specialRequests ?? '',
    p_internal_notes: p.internalNotes ?? '',
    p_payment_due_at: p.paymentDueAt ?? null,
  })
  if (error) throw new Error(error.message)
  const result = data as { id: string; code: string }
  return result
}

export type UpdateBookingParams = {
  bookingId: string
  version: number
  roomId: string
  responsibleGuestId: string
  checkin: string
  checkout: string
  adults: number
  children: number
  infants: number
  pets: boolean
  subtotal: number
  fee: number
  discount: number
  surcharge: number
  servicesAmount: number
  total: number
  origin: BookingOrigin
  expectedArrivalTime?: string | null
  specialRequests?: string
  internalNotes?: string
}

export async function updateBookingRpc(p: UpdateBookingParams): Promise<{ version: number }> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('update_booking', {
    p_booking_id: p.bookingId,
    p_version: p.version,
    p_room_id: p.roomId,
    p_responsible_guest_id: p.responsibleGuestId,
    p_checkin: p.checkin,
    p_checkout: p.checkout,
    p_adults: p.adults,
    p_children: p.children,
    p_infants: p.infants,
    p_pets: p.pets,
    p_subtotal: p.subtotal,
    p_fee: p.fee,
    p_discount: p.discount,
    p_surcharge: p.surcharge,
    p_services_amount: p.servicesAmount,
    p_total: p.total,
    p_origin: p.origin,
    p_expected_arrival_time: p.expectedArrivalTime ?? null,
    p_special_requests: p.specialRequests ?? '',
    p_internal_notes: p.internalNotes ?? '',
  })
  if (error) throw new Error(error.message)
  return data as { version: number }
}

export async function setBookingStatusRpc(
  bookingId: string,
  status: BookingStatus,
  reason?: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc('set_booking_status', {
    p_booking_id: bookingId,
    p_new_status: status,
    p_reason: reason ?? null,
  })
  if (error) throw new Error(error.message)
}

export async function expirePendingBookingRpc(bookingId: string): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc('expire_pending_booking', { p_booking_id: bookingId })
  if (error) throw new Error(error.message)
}

/**
 * Expiração automática em lote (0050, cron) — service_role, sem sessão de
 * usuário e sem tenant: varre TODAS as pousadas de uma vez. Nunca confundir
 * com `expirePendingBookingRpc` acima (botão manual "Expirar", uma reserva
 * por vez, exige sessão) — são duas RPCs diferentes no banco, cada uma só
 * concedida ao papel certo.
 */
export async function expireOverduePendingBookingsRpc(): Promise<{ expired: number }> {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc('expire_overdue_pending_bookings')
  if (error) throw new Error(error.message)
  return data as { expired: number }
}

export async function setBookingCompanionsRpc(
  bookingId: string,
  version: number,
  companions: {
    guestId?: string | null
    fullName: string
    guestType: string
    hasSpecialNeeds?: boolean
    birthDate?: string | null
    documentType?: string | null
    documentNumber?: string | null
    operationalNotes?: string
  }[],
): Promise<{ version: number }> {
  const supabase = await createSupabaseServerClient()
  const payload = companions.map((c) => ({
    guestId: c.guestId ?? null,
    fullName: c.fullName,
    guestType: c.guestType,
    hasSpecialNeeds: c.hasSpecialNeeds ?? false,
    birthDate: c.birthDate ?? null,
    documentType: c.documentType ?? null,
    documentNumber: c.documentNumber ?? null,
    operationalNotes: c.operationalNotes ?? '',
  }))
  const { data, error } = await supabase.rpc('set_booking_companions', {
    p_booking_id: bookingId,
    p_version: version,
    p_companions: payload,
  })
  if (error) throw new Error(error.message)
  return data as { version: number }
}

// ----------------------------------------------------------------------------
// Leitura do lado do hóspede (/minhas-reservas) — nunca seleciona colunas
// internas (internal_notes, cancellation_reason, no_show_reason): a RLS de
// SELECT já é a mesma para hóspede/equipe operacional (não filtra coluna),
// então a garantia real de que o hóspede nunca veja essas colunas vem de
// nunca incluí-las no `select()` usado aqui (decisão registrada na Entrega
// do Ciclo 4, item 5/9).
// ----------------------------------------------------------------------------
const GUEST_BOOKING_COLUMNS =
  'id, code, pousada_id, room_id, checkin, checkout, guests, subtotal, fee, discount, surcharge, total, balance_due, status, origin, payment_due_at, cancellation_reason, created_at'

export async function listBookingsByGuest(guestId: string): Promise<Booking[]> {
  const supabase = await createSupabaseServerClient()

  const { data: rows, error } = await supabase
    .from('bookings')
    .select(GUEST_BOOKING_COLUMNS)
    .eq('guest_id', guestId)
    .order('created_at', { ascending: false })
  if (error) throw error
  if (!rows || rows.length === 0) return []

  const pousadaIds = [...new Set(rows.map((r) => r.pousada_id))]
  const { data: pousadas } = await supabase
    .from('pousadas')
    .select('id, slug, name, image, city, state')
    .in('id', pousadaIds)
  const byId = new Map((pousadas ?? []).map((p) => [p.id, p]))
  const roomIds = [...new Set(rows.map((r) => r.room_id))]
  const { data: rooms } = await supabase.from('rooms').select('id, name').in('id', roomIds)
  const roomById = new Map((rooms ?? []).map((room) => [room.id, room]))
  const pendingIds = rows.filter((r) => r.status === 'pending').map((r) => r.id)
  const awaitingApproval = await listMyBookingIdsAwaitingApproval(pendingIds)

  return rows.map((r) => {
    const p = byId.get(r.pousada_id)
    return {
      id: r.id,
      code: r.code,
      pousadaSlug: p?.slug ?? '',
      pousadaName: p?.name ?? 'Pousada',
      pousadaImage: p?.image ?? '/placeholder.svg',
      roomName: roomById.get(r.room_id)?.name ?? 'Acomodação',
      city: p?.city ?? '',
      state: p?.state ?? '',
      checkin: r.checkin,
      checkout: r.checkout,
      guests: r.guests,
      nights: nightsBetween(r.checkin, r.checkout),
      subtotal: Number(r.subtotal),
      fee: Number(r.fee),
      discount: Number(r.discount),
      surcharge: Number(r.surcharge),
      total: Number(r.total),
      balanceDue: Number(r.balance_due),
      status: r.status as BookingStatus,
      paymentDueAt: r.payment_due_at,
      awaitingPixApproval: awaitingApproval.has(r.id),
      cancellationReason: r.cancellation_reason,
      createdAt: r.created_at,
    }
  })
}

export async function getBookingByGuest(
  bookingId: string,
  guestId: string,
): Promise<{ id: string; status: BookingStatus; paymentDueAt: string | null } | null> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('bookings')
    .select('id, status, payment_due_at')
    .eq('id', bookingId)
    .eq('guest_id', guestId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return { id: data.id, status: data.status as BookingStatus, paymentDueAt: data.payment_due_at }
}

/** Dados mínimos pro checkout de pagamento — mesma regra de coluna do hóspede: nunca campos internos. */
export type BookingForCheckout = {
  balanceDue: number
  id: string
  code: string
  pousadaId: string
  status: BookingStatus
  total: number
  fee: number
  guestName: string | null
  guestEmail: string | null
  /** Prazo de pagamento (ISO). `null` = sem prazo. */
  paymentDueAt: string | null
}

export async function getBookingForCheckout(
  bookingId: string,
  guestId: string,
): Promise<BookingForCheckout | null> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('bookings')
    .select(
      'id, code, pousada_id, status, total, fee, guest_name, guest_email, balance_due, payment_due_at',
    )
    .eq('id', bookingId)
    .eq('guest_id', guestId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return {
    id: data.id,
    code: data.code,
    pousadaId: data.pousada_id,
    status: data.status as BookingStatus,
    total: Number(data.total),
    fee: Number(data.fee),
    guestName: data.guest_name,
    guestEmail: data.guest_email,
    balanceDue: Number(data.balance_due),
    paymentDueAt: data.payment_due_at ?? null,
  }
}

// ----------------------------------------------------------------------------
// Leitura administrativa completa (/dashboard/reservas/[id]) — só alcançável
// por quem tem acesso operacional à pousada (garantido pela RLS de bookings_read).
// ----------------------------------------------------------------------------
export async function getBookingDetailById(
  bookingId: string,
  pousadaId: string,
): Promise<BookingDetail | null> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('bookings')
    .select(
      'id, code, pousada_id, room_id, responsible_guest_id, guest_id, guest_name, guest_email, guest_phone, checkin, checkout, adults, children, infants, pets, status, origin, external_channel_name, external_code, subtotal, fee, discount, surcharge, services_amount, total, amount_received, balance_due, currency, expected_arrival_time, special_requests, internal_notes, cancellation_reason, cancelled_at, no_show_reason, no_show_at, payment_due_at, version, created_at, updated_at',
    )
    .eq('id', bookingId)
    .eq('pousada_id', pousadaId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null

  const { data: room } = await supabase
    .from('rooms')
    .select('name')
    .eq('id', data.room_id)
    .maybeSingle()
  const { data: companionRows } = await supabase
    .from('booking_guests')
    .select(
      'id, guest_id, full_name, guest_type, has_special_needs, birth_date, document_type, document_number, operational_notes',
    )
    .eq('booking_id', bookingId)

  const companions: BookingCompanion[] = (companionRows ?? []).map((c) => ({
    id: c.id,
    guestId: c.guest_id,
    fullName: c.full_name,
    guestType: c.guest_type,
    hasSpecialNeeds: c.has_special_needs,
    birthDate: c.birth_date,
    documentType: c.document_type,
    documentNumber: c.document_number,
    operationalNotes: c.operational_notes,
  }))

  return {
    id: data.id,
    code: data.code,
    pousadaId: data.pousada_id,
    roomId: data.room_id,
    roomName: room?.name ?? 'Acomodação',
    responsibleGuestId: data.responsible_guest_id,
    guestName: data.guest_name ?? 'Hóspede',
    guestEmail: data.guest_email,
    guestPhone: data.guest_phone,
    travelerUserId: data.guest_id,
    checkin: data.checkin,
    checkout: data.checkout,
    nights: nightsBetween(data.checkin, data.checkout),
    adults: data.adults,
    children: data.children,
    infants: data.infants,
    pets: data.pets,
    status: data.status as BookingStatus,
    origin: data.origin as BookingOrigin,
    externalChannelName: data.external_channel_name,
    externalCode: data.external_code,
    subtotal: Number(data.subtotal),
    fee: Number(data.fee),
    discount: Number(data.discount),
    surcharge: Number(data.surcharge),
    servicesAmount: Number(data.services_amount),
    total: Number(data.total),
    amountReceived: Number(data.amount_received),
    balanceDue: Number(data.balance_due),
    currency: data.currency,
    expectedArrivalTime: data.expected_arrival_time,
    specialRequests: data.special_requests,
    internalNotes: data.internal_notes,
    cancellationReason: data.cancellation_reason,
    cancelledAt: data.cancelled_at,
    noShowReason: data.no_show_reason,
    noShowAt: data.no_show_at,
    paymentDueAt: data.payment_due_at,
    version: data.version,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    companions,
  }
}

/**
 * Dados para a ficha FNRH impressa — reserva + hóspede responsável (o
 * PERFIL completo em `guests`, não só o snapshot em `bookings.guest_name/
 * email/phone`) + acompanhantes. Mesmo escopo de leitura de
 * `getBookingDetailById` (pousadaId já resolvido por `booking:manage`); só
 * projeta as colunas que a ficha usa. Dados da pousada (cabeçalho impresso)
 * ficam de fora — quem chama junta com `getPousadaSettings`.
 */
export async function getBookingFnrhData(
  bookingId: string,
  pousadaId: string,
): Promise<Omit<FnrhData, 'pousada'> | null> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('bookings')
    .select(
      'id, code, room_id, responsible_guest_id, guest_name, guest_email, guest_phone, checkin, checkout, adults, children, infants',
    )
    .eq('id', bookingId)
    .eq('pousada_id', pousadaId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null

  const [{ data: room }, { data: guest }, { data: companionRows }] = await Promise.all([
    supabase.from('rooms').select('name').eq('id', data.room_id).maybeSingle(),
    supabase
      .from('guests')
      .select(
        'full_name, email, phone, document_type, document_number, birth_date, nationality, country, city, state, address, cep',
      )
      .eq('id', data.responsible_guest_id)
      .maybeSingle(),
    supabase
      .from('booking_guests')
      .select('full_name, guest_type, document_type, document_number, birth_date')
      .eq('booking_id', bookingId)
      .neq('guest_type', 'responsible')
      .order('created_at', { ascending: true }),
  ])

  return {
    booking: {
      code: data.code,
      roomName: room?.name ?? 'Acomodação',
      checkin: data.checkin,
      checkout: data.checkout,
      nights: nightsBetween(data.checkin, data.checkout),
      adults: data.adults,
      children: data.children,
      infants: data.infants,
    },
    responsible: {
      // `guests` pode não ter linha (reserva antiga ou hóspede removido) — cai
      // para o snapshot da reserva, igual a `getBookingDetailById`.
      fullName: guest?.full_name ?? data.guest_name ?? 'Hóspede',
      email: guest?.email ?? data.guest_email,
      phone: guest?.phone ?? data.guest_phone,
      documentType: guest?.document_type ?? null,
      documentNumber: guest?.document_number
        ? safeDecryptDocumentNumber(guest.document_number)
        : null,
      birthDate: guest?.birth_date ?? null,
      nationality: guest?.nationality ?? null,
      country: guest?.country ?? null,
      city: guest?.city ?? null,
      state: guest?.state ?? null,
      address: guest?.address ?? null,
      cep: guest?.cep ?? null,
    },
    companions: (companionRows ?? []).map((c) => ({
      fullName: c.full_name,
      guestType: c.guest_type as BookingCompanion['guestType'],
      documentType: c.document_type,
      documentNumber: c.document_number,
      birthDate: c.birth_date,
    })),
  }
}

export type BookingNotificationContext = {
  bookingId: string
  code: string
  guestName: string | null
  guestEmail: string | null
  checkin: string
  checkout: string
  total: number
  currency: string
  roomName: string
  /** 0071 — opcionais: ausentes em respostas de RPC anteriores à migration. */
  status?: string
  adults?: number
  children?: number
  paymentDueAt?: string | null
  pousada: {
    name: string
    slug: string
    city?: string | null
    state?: string | null
    timezone?: string | null
    address: string | null
    cep: string | null
    checkinTime: string
    checkoutTime: string
    contactPhone: string
    whatsapp: string
    houseRules: string
    cancellationPolicy: string
  }
}

/**
 * Reserva + pousada pra montar e-mail de notificação (0060). `service_role`
 * só, via RPC estreita — nunca lê tabela direto (mesmo padrão de
 * `expireOverduePendingBookingsRpc` acima).
 *
 * Chamada também a partir de `createBooking` (com sessão de usuário) e não só
 * do webhook (sem sessão): é seguro porque o `bookingId` ali vem de uma
 * reserva que o PRÓPRIO código acabou de criar na mesma chamada — nunca um
 * id vindo de fora sendo confiado às cegas. A função no banco não expõe
 * `authenticated`/`anon` de propósito (ver 0060), então não dá pra ler
 * reserva alheia mesmo que alguém tentasse chamar a RPC direto.
 */
export async function getBookingNotificationContextRpc(
  bookingId: string,
): Promise<BookingNotificationContext | null> {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc('get_booking_notification_context', {
    p_booking_id: bookingId,
  })
  if (error) throw new Error(error.message)
  return (data as BookingNotificationContext | null) ?? null
}

/**
 * Lembrete de check-in (0060) — cron diário, sem sessão de usuário. Seleciona
 * e marca `checkin_reminder_sent_at` na mesma chamada (ver comentário da RPC
 * na migration) — idempotente entre execuções.
 */
export async function listAndMarkCheckinRemindersRpc(
  daysAhead = 2,
): Promise<BookingNotificationContext[]> {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc('list_and_mark_checkin_reminders', {
    p_days_ahead: daysAhead,
  })
  if (error) throw new Error(error.message)
  return (data as BookingNotificationContext[] | null) ?? []
}
