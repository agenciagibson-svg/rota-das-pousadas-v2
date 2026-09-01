import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { listActiveBlocksOverlapping } from '@/repositories/room-blocks.repository'
import { evaluateRoomAvailability, validateDateRange } from '@/features/acomodacoes/availability-engine'
import type { AvailabilityResult } from '@/features/acomodacoes/types'

const OCCUPYING_BOOKING_STATUSES = ['iniciada', 'aguardando_pagamento', 'confirmada', 'em_estadia']

export type AvailabilityQuery = {
  pousadaId: string
  checkin: string
  checkout: string
  adults: number
  children: number
  pets: boolean
  categoryId?: string
  roomId?: string
}

/**
 * Motor de disponibilidade — busca no banco (rooms + room_blocks + bookings)
 * e delega a decisão por acomodação ao motor puro e testável
 * (features/acomodacoes/availability-engine.ts). NÃO lê a tabela
 * `availability` antiga (ver nota de arquitetura em 0022_*.sql).
 */
export async function queryAvailability(query: AvailabilityQuery): Promise<AvailabilityResult[]> {
  if (!validateDateRange(query.checkin, query.checkout)) {
    throw new Error('Datas inválidas: a saída deve ser depois da entrada.')
  }

  const supabase = await createSupabaseServerClient()

  let roomsQuery = supabase
    .from('rooms')
    .select('id, name, capacity_max, capacity, pets_allowed, status, operational_status, category_id, accommodation_categories(name, status)')
    .eq('pousada_id', query.pousadaId)
  if (query.categoryId) roomsQuery = roomsQuery.eq('category_id', query.categoryId)
  if (query.roomId) roomsQuery = roomsQuery.eq('id', query.roomId)

  const { data: rooms, error } = await roomsQuery
  if (error) throw error
  const roomList = rooms ?? []
  const roomIds = roomList.map((r) => r.id)

  const [blocks, bookingsResult] = await Promise.all([
    listActiveBlocksOverlapping(roomIds, query.checkin, query.checkout),
    roomIds.length
      ? supabase
          .from('bookings')
          .select('room_id, checkin, checkout, status')
          .in('room_id', roomIds)
          .in('status', OCCUPYING_BOOKING_STATUSES)
          .lt('checkin', query.checkout)
          .gt('checkout', query.checkin)
      : Promise.resolve({ data: [] as { room_id: string }[] }),
  ])
  const blockedRoomIds = new Set(blocks.map((b) => b.roomId))
  const bookedRoomIds = new Set((bookingsResult.data ?? []).map((b) => b.room_id))

  return roomList.map((r) => {
    const category = Array.isArray(r.accommodation_categories) ? r.accommodation_categories[0] : r.accommodation_categories
    const capacityMax = r.capacity_max ?? r.capacity
    const reasons = evaluateRoomAvailability({
      roomStatus: r.status,
      categoryStatus: category?.status ?? null,
      operationalStatus: r.operational_status,
      capacityMax,
      petsAllowed: r.pets_allowed,
      requestedAdults: query.adults,
      requestedChildren: query.children,
      requestedPets: query.pets,
      hasBlockConflict: blockedRoomIds.has(r.id),
      hasBookingConflict: bookedRoomIds.has(r.id),
    })
    return {
      roomId: r.id,
      roomName: r.name,
      categoryName: category?.name ?? null,
      capacity: capacityMax,
      available: reasons.length === 0,
      reasons,
    }
  })
}
