import 'server-only'
import { getCurrentUser } from '@/features/auth/services/auth.service'
import { isSupabaseConfigured } from '@/lib/env'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { listMyBookingRows } from '@/repositories/bookings.repository'
import { insertReview, type InsertReviewResult } from '@/repositories/reviews.repository'
import { reviewAvailability, type ReviewAvailability } from '../review'
import {
  cancelGuestOrderRpc,
  getGuestStayRpc,
  listBookingOrders,
  placeGuestOrderRpc,
} from '@/repositories/orders.repository'
import { DEMO_STAY_ID, demoMyStays, demoStay } from '../demo'
import { parseGuestStay, type GuestStay } from '../types'
import type { GuestOrder } from '@/features/pedidos/types'

export type MyStay = {
  id: string
  code: string
  pousadaName: string
  roomName: string
  checkin: string
  checkout: string
  status: string
}

/** Estadias do usuário que ainda fazem sentido no app (confirmadas, em curso ou recém-encerradas). */
export async function listMyStays(): Promise<MyStay[]> {
  // Modo demonstração (preview sem Supabase): uma estadia de exemplo em curso.
  if (!isSupabaseConfigured()) return demoMyStays()
  const user = await getCurrentUser()
  if (!user) return []
  const supabase = await createSupabaseServerClient()
  const recent = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10)
  // O hóspede não lê `bookings` direto (0085) — só pela RPC, com colunas de hóspede.
  const rows = (await listMyBookingRows())
    .filter((r) => ['confirmed', 'checked_in', 'checked_out'].includes(r.status))
    .filter((r) => r.checkout >= recent)
    .sort((a, b) => a.checkin.localeCompare(b.checkin))
  const pousadaIds = [...new Set(rows.map((r) => r.pousada_id))]
  const { data: pousadas } = pousadaIds.length
    ? await supabase.from('pousadas').select('id, name').in('id', pousadaIds)
    : { data: [] as { id: string; name: string }[] }
  const pName = new Map((pousadas ?? []).map((p) => [p.id, p.name]))
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    pousadaName: pName.get(r.pousada_id) ?? 'Pousada',
    roomName: r.room_name ?? 'Acomodação',
    checkin: r.checkin,
    checkout: r.checkout,
    status: r.status,
  }))
}

export async function getStay(
  bookingId: string,
): Promise<{ stay: GuestStay; orders: GuestOrder[] } | null> {
  if (!isSupabaseConfigured()) return bookingId === DEMO_STAY_ID ? demoStay() : null
  try {
    const [raw, orders] = await Promise.all([
      getGuestStayRpc(bookingId),
      listBookingOrders(bookingId),
    ])
    return { stay: parseGuestStay(raw), orders }
  } catch (e) {
    const msg = e instanceof Error ? e.message : ''
    if (/Reserva não encontrada|Faça login/.test(msg)) return null
    throw e
  }
}

export async function placeOrder(
  bookingId: string,
  items: { itemId: string; quantity: number }[],
  note: string,
) {
  // Demonstração: o pedido "vai" (aviso de enviado), mas nada é gravado.
  if (!isSupabaseConfigured()) {
    return { orderId: `demo-${Date.now()}`, total: 0 }
  }
  return placeGuestOrderRpc(bookingId, items, note)
}

export async function cancelOrder(orderId: string) {
  if (!isSupabaseConfigured()) return
  await cancelGuestOrderRpc(orderId)
}

export async function submitReview(bookingId: string, rating: number, text: string) {
  if (!isSupabaseConfigured()) return
  const user = await getCurrentUser()
  if (!user) throw new Error('Faça login.')
  const [b] = await listMyBookingRows(bookingId)
  if (!b) throw new Error('Reserva não encontrada.')
  let result: InsertReviewResult
  try {
    result = await insertReview({
      pousadaId: b.pousada_id,
      bookingId,
      authorId: user.id,
      rating,
      text,
    })
  } catch {
    throw new Error('Não foi possível enviar a avaliação. Tente de novo.')
  }
  if (result === 'duplicate') throw new Error('Você já avaliou esta estadia. Obrigado!')
  if (result === 'not_allowed') {
    throw new Error('A avaliação fica liberada a partir do dia do check-out.')
  }
}

export type StayReviewContext = {
  bookingId: string
  pousadaName: string
  pousadaSlug: string
  checkin: string
  checkout: string
  availability: ReviewAvailability
}

/**
 * Dados da página de avaliação (link do e-mail). Lê pela mesma RPC do app da
 * estadia (`get_guest_stay`), que só devolve reserva do usuário logado e já
 * diz se ele pode avaliar (`auth_can_review_booking`) e se já avaliou.
 * `null` = reserva inexistente ou de outra conta.
 */
export async function getStayReviewContext(bookingId: string): Promise<StayReviewContext | null> {
  let stay: GuestStay
  if (!isSupabaseConfigured()) {
    if (bookingId !== DEMO_STAY_ID) return null
    stay = (await demoStay()).stay
  } else {
    try {
      stay = parseGuestStay(await getGuestStayRpc(bookingId))
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      if (/Reserva não encontrada|Faça login/.test(msg)) return null
      throw e
    }
  }
  return {
    bookingId: stay.booking.id,
    pousadaName: stay.pousada.name,
    pousadaSlug: stay.pousada.slug,
    checkin: stay.booking.checkin,
    checkout: stay.booking.checkout,
    availability: reviewAvailability({
      canReview: stay.canReview,
      reviewed: stay.reviewed,
      status: stay.booking.status,
      today: stay.today,
      checkout: stay.booking.checkout,
    }),
  }
}
