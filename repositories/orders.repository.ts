import 'server-only'
import {
  readList,
  type AgendaItem,
  type EmergencyContact,
  type Facility,
  type LocalTip,
} from '@/features/estadia/info'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { Json } from '@/lib/supabase/database.types'
import {
  toSummary,
  type ConsumptionPayment,
  type ConsumptionSummary,
  type GuestOrder,
  type GuestSettings,
  type OrderStatus,
} from '@/features/pedidos/types'

/** Pedidos do hóspede e conta de consumo (0078). Leitura por RLS, escrita por RPC. */

type OrderRow = {
  id: string
  booking_id: string
  status: string
  source: string
  note: string
  total: number
  created_at: string
  accepted_at: string | null
  delivered_at: string | null
  cancelled_at: string | null
  cancel_reason: string | null
}

async function hydrate(rows: OrderRow[]): Promise<GuestOrder[]> {
  if (rows.length === 0) return []
  const supabase = await createSupabaseServerClient()
  const orderIds = rows.map((r) => r.id)
  const bookingIds = [...new Set(rows.map((r) => r.booking_id))]
  const [{ data: lines }, { data: bookings }] = await Promise.all([
    supabase
      .from('guest_order_items')
      .select('order_id, item_id, name, unit, unit_price, quantity, line_total')
      .in('order_id', orderIds),
    supabase.from('bookings').select('id, code, guest_name, room_id').in('id', bookingIds),
  ])
  const roomIds = [...new Set((bookings ?? []).map((b) => b.room_id))]
  const { data: rooms } = roomIds.length
    ? await supabase.from('rooms').select('id, name').in('id', roomIds)
    : { data: [] as { id: string; name: string }[] }
  const roomById = new Map((rooms ?? []).map((r) => [r.id, r.name]))
  const bookingById = new Map((bookings ?? []).map((b) => [b.id, b]))

  return rows.map((r) => {
    const b = bookingById.get(r.booking_id)
    return {
      id: r.id,
      bookingId: r.booking_id,
      bookingCode: b?.code ?? '',
      guestName: b?.guest_name ?? 'Hóspede',
      roomName: (b && roomById.get(b.room_id)) || 'Acomodação',
      status: r.status as OrderStatus,
      source: r.source as GuestOrder['source'],
      note: r.note,
      total: Number(r.total),
      lines: (lines ?? [])
        .filter((l) => l.order_id === r.id)
        .map((l) => ({
          itemId: l.item_id,
          name: l.name,
          unit: l.unit,
          unitPrice: Number(l.unit_price),
          quantity: l.quantity,
          lineTotal: Number(l.line_total),
        })),
      createdAt: r.created_at,
      acceptedAt: r.accepted_at,
      deliveredAt: r.delivered_at,
      cancelledAt: r.cancelled_at,
      cancelReason: r.cancel_reason,
    }
  })
}

const ORDER_COLUMNS =
  'id, booking_id, status, source, note, total, created_at, accepted_at, delivered_at, cancelled_at, cancel_reason'

/** Pedidos em aberto + os fechados desde `sinceISO`. */
export async function listPousadaOrders(
  pousadaId: string,
  sinceISO: string,
): Promise<GuestOrder[]> {
  const supabase = await createSupabaseServerClient()
  const [open, closed] = await Promise.all([
    supabase
      .from('guest_orders')
      .select(ORDER_COLUMNS)
      .eq('pousada_id', pousadaId)
      .in('status', ['novo', 'preparando'])
      .order('created_at', { ascending: true }),
    supabase
      .from('guest_orders')
      .select(ORDER_COLUMNS)
      .eq('pousada_id', pousadaId)
      .in('status', ['entregue', 'cancelado'])
      .gte('updated_at', sinceISO)
      .order('updated_at', { ascending: false })
      .limit(50),
  ])
  if (open.error) throw new Error(open.error.message)
  if (closed.error) throw new Error(closed.error.message)
  return hydrate([...(open.data ?? []), ...(closed.data ?? [])] as OrderRow[])
}

export async function listBookingOrders(bookingId: string): Promise<GuestOrder[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('guest_orders')
    .select(ORDER_COLUMNS)
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return hydrate((data ?? []) as OrderRow[])
}

export async function getOrderPousadaId(orderId: string): Promise<string | null> {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from('guest_orders')
    .select('pousada_id')
    .eq('id', orderId)
    .maybeSingle()
  return data?.pousada_id ?? null
}

export async function setOrderStatusRpc(
  orderId: string,
  status: OrderStatus,
  reason: string | null,
) {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc('set_guest_order_status', {
    p_order_id: orderId,
    p_status: status,
    p_reason: reason,
  })
  if (error) throw new Error(error.message)
}

export async function staffCreateOrderRpc(
  bookingId: string,
  items: { itemId: string; quantity: number }[],
  note: string,
): Promise<{ orderId: string; total: number }> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('staff_create_order', {
    p_booking_id: bookingId,
    p_items: items as unknown as Json,
    p_note: note,
  })
  if (error) throw new Error(error.message)
  return data as { orderId: string; total: number }
}

export async function getConsumptionRpc(bookingId: string): Promise<ConsumptionSummary> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('get_booking_consumption', { p_booking_id: bookingId })
  if (error) throw new Error(error.message)
  return toSummary(data as { delivered: number; open: number; paid: number })
}

export async function listConsumptionPayments(bookingId: string): Promise<ConsumptionPayment[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('consumption_payments')
    .select('id, amount, method, note, created_at, reverses_id')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  const rows = data ?? []
  // 0083: estorno é um lançamento negativo que aponta para o pagamento original.
  const reversedIds = new Set(rows.map((p) => p.reverses_id).filter(Boolean))
  return rows.map((p) => ({
    id: p.id,
    amount: Number(p.amount),
    method: p.method as ConsumptionPayment['method'],
    note: p.note,
    createdAt: p.created_at,
    isReversal: p.reverses_id !== null,
    reversed: reversedIds.has(p.id),
  }))
}

/** Pousada e reserva de um pagamento de consumo (a RLS já restringe à equipe). */
export async function getConsumptionPaymentRef(
  paymentId: string,
): Promise<{ pousadaId: string; bookingId: string } | null> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('consumption_payments')
    .select('pousada_id, booking_id')
    .eq('id', paymentId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? { pousadaId: data.pousada_id, bookingId: data.booking_id } : null
}

/** Estorna um pagamento de consumo (0083): lançamento negativo + auditoria. */
export async function reverseConsumptionPaymentRpc(
  paymentId: string,
  reason: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc('reverse_consumption_payment', {
    p_payment_id: paymentId,
    p_reason: reason,
  })
  if (error) throw new Error(error.message)
}

export async function registerConsumptionPaymentRpc(
  bookingId: string,
  amount: number,
  method: ConsumptionPayment['method'],
  note: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc('register_consumption_payment', {
    p_booking_id: bookingId,
    p_amount: amount,
    p_method: method,
    p_note: note,
  })
  if (error) throw new Error(error.message)
}

/** Recebido do consumo num período (para o Financeiro). */
export async function sumConsumptionPayments(pousadaId: string): Promise<number> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('consumption_payments')
    .select('amount')
    .eq('pousada_id', pousadaId)
  if (error) throw new Error(error.message)
  return (data ?? []).reduce((s, p) => s + Number(p.amount), 0)
}

export async function listConsumptionPaymentsByPousada(pousadaId: string, limit = 50) {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('consumption_payments')
    .select('id, booking_id, amount, method, created_at')
    .eq('pousada_id', pousadaId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getGuestSettings(pousadaId: string): Promise<GuestSettings> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('pousada_guest_settings')
    .select(
      'wifi_name, wifi_password, guest_info, orders_enabled, orders_hours, breakfast_info, parking_info, facilities, daily_agenda, local_tips, emergency',
    )
    .eq('pousada_id', pousadaId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return {
    wifiName: data?.wifi_name ?? '',
    wifiPassword: data?.wifi_password ?? '',
    guestInfo: data?.guest_info ?? '',
    ordersEnabled: data?.orders_enabled ?? true,
    ordersHours: data?.orders_hours ?? '',
    breakfastInfo: data?.breakfast_info ?? '',
    parkingInfo: data?.parking_info ?? '',
    facilities: readList<Facility>(data?.facilities, ['name', 'hours']),
    dailyAgenda: readList<AgendaItem>(data?.daily_agenda, ['time', 'title', 'note']),
    localTips: readList<LocalTip>(data?.local_tips, ['name', 'kind', 'distance']),
    emergency: readList<EmergencyContact>(data?.emergency, ['label', 'phone']),
  }
}

export async function saveGuestSettings(pousadaId: string, s: GuestSettings): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.from('pousada_guest_settings').upsert({
    pousada_id: pousadaId,
    wifi_name: s.wifiName,
    wifi_password: s.wifiPassword,
    guest_info: s.guestInfo,
    orders_enabled: s.ordersEnabled,
    orders_hours: s.ordersHours,
    breakfast_info: s.breakfastInfo,
    parking_info: s.parkingInfo,
    facilities: s.facilities,
    daily_agenda: s.dailyAgenda,
    local_tips: s.localTips,
    emergency: s.emergency,
    updated_at: new Date().toISOString(),
  })
  if (error) throw new Error(error.message)
}

// ---------------------------------------------------------------------------
// App do hóspede
// ---------------------------------------------------------------------------
export async function getGuestStayRpc(bookingId: string): Promise<unknown> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('get_guest_stay', { p_booking_id: bookingId })
  if (error) throw new Error(error.message)
  return data
}

export async function placeGuestOrderRpc(
  bookingId: string,
  items: { itemId: string; quantity: number }[],
  note: string,
): Promise<{ orderId: string; total: number }> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('place_guest_order', {
    p_booking_id: bookingId,
    p_items: items as unknown as Json,
    p_note: note,
  })
  if (error) throw new Error(error.message)
  return data as { orderId: string; total: number }
}

export async function cancelGuestOrderRpc(orderId: string): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc('cancel_guest_order', { p_order_id: orderId })
  if (error) throw new Error(error.message)
}

/**
 * Por reserva: quanto foi consumido (pedidos entregues) e quanto já foi pago.
 * Somado no banco (`consumption_totals_by_pousada`, 0083): lendo as linhas e
 * somando aqui, os totais passavam a errar em silêncio depois de 1000 linhas,
 * que é o teto de uma resposta da API.
 */
export async function consumptionTotalsByPousada(
  pousadaId: string,
): Promise<{ bookingId: string; delivered: number; paid: number }[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('consumption_totals_by_pousada', {
    p_pousada_id: pousadaId,
  })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({
    bookingId: row.booking_id,
    delivered: Number(row.delivered),
    paid: Number(row.paid),
  }))
}
