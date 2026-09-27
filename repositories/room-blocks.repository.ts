import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { RoomBlock, RoomBlockType } from '@/features/acomodacoes/types'

type BlockRow = {
  id: string
  room_id: string
  block_type: RoomBlock['blockType']
  starts_at: string
  ends_at: string
  reason: string
  notes: string
  status: RoomBlock['status']
  created_by: string | null
  cancelled_by: string | null
  created_at: string
  cancelled_at: string | null
  cancellation_reason: string | null
  rooms: { name: string } | { name: string }[] | null
}

function roomName(v: BlockRow['rooms']): string {
  if (!v) return ''
  return Array.isArray(v) ? (v[0]?.name ?? '') : v.name
}

export async function listBlocksByPousada(pousadaId: string): Promise<RoomBlock[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('room_blocks')
    .select(
      'id, room_id, block_type, starts_at, ends_at, reason, notes, status, created_by, cancelled_by, created_at, cancelled_at, cancellation_reason, rooms(name)',
    )
    .eq('pousada_id', pousadaId)
    .order('starts_at', { ascending: false })
  if (error) throw error
  return ((data ?? []) as unknown as BlockRow[]).map((b) => ({
    id: b.id,
    roomId: b.room_id,
    roomName: roomName(b.rooms),
    blockType: b.block_type,
    startsAt: b.starts_at,
    endsAt: b.ends_at,
    reason: b.reason,
    notes: b.notes,
    status: b.status,
    createdBy: b.created_by,
    cancelledBy: b.cancelled_by,
    createdAt: b.created_at,
    cancelledAt: b.cancelled_at,
    cancellationReason: b.cancellation_reason,
  }))
}

/** Bloqueios ATIVOS de um conjunto de acomodações, que tocam o período pedido — usado pelo motor de disponibilidade. */
export async function listActiveBlocksOverlapping(
  roomIds: string[],
  checkin: string,
  checkout: string,
): Promise<{ roomId: string; startsAt: string; endsAt: string }[]> {
  if (roomIds.length === 0) return []
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('room_blocks')
    .select('room_id, starts_at, ends_at')
    .in('room_id', roomIds)
    .eq('status', 'active')
    .lt('starts_at', `${checkout}T00:00:00Z`)
    .gt('ends_at', `${checkin}T00:00:00Z`)
  if (error) throw error
  return (data ?? []).map((b) => ({ roomId: b.room_id, startsAt: b.starts_at, endsAt: b.ends_at }))
}

export async function createRoomBlock(input: {
  pousadaId: string
  roomId: string
  blockType: RoomBlockType
  startsAt: string
  endsAt: string
  reason: string
  notes: string
  source?: string
}): Promise<{ id: string }> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('create_room_block', {
    p_pousada_id: input.pousadaId,
    p_room_id: input.roomId,
    p_block_type: input.blockType,
    p_starts_at: input.startsAt,
    p_ends_at: input.endsAt,
    p_reason: input.reason,
    p_notes: input.notes,
    p_source: input.source ?? 'dashboard',
  })
  if (error) throw new Error(error.message)
  return { id: (data as { id: string })?.id }
}

function toDayIso(date: string): string {
  return `${date}T00:00:00.000Z`
}
function nextDayIso(date: string): string {
  const d = new Date(`${date}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString()
}

/**
 * [Ciclo 3B] Compatibilidade do calendário legado (features/gestao) com a
 * fonte canônica `room_blocks`. Cada clique no calendário vira um bloqueio de
 * 1 dia (UTC — mesmo tratamento de data civil já usado em `bookings.checkin/
 * checkout`, sem conversão de fuso adicional, para não introduzir uma regra
 * de timezone diferente do resto do app) com `source='legacy_calendar'` e um
 * motivo padrão (o calendário legado não coleta motivo — UX de um clique).
 */
export async function blockCalendarDay(
  pousadaId: string,
  roomId: string,
  date: string,
): Promise<void> {
  await createRoomBlock({
    pousadaId,
    roomId,
    blockType: 'operational_unavailability',
    startsAt: toDayIso(date),
    endsAt: nextDayIso(date),
    reason: 'Bloqueio manual via calendário de reservas.',
    notes: '',
    source: 'legacy_calendar',
  })
}

/**
 * Cancela SÓ um bloqueio de 1 dia que corresponda exatamente a essa data
 * (criado pelo próprio calendário legado). Se o dia fizer parte de um
 * bloqueio maior (criado na tela de Bloqueios), recusa e orienta o usuário —
 * nunca cancela um bloqueio maior por engano a partir de um clique de 1 dia.
 */
export async function unblockCalendarDay(
  pousadaId: string,
  roomId: string,
  date: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const dayStart = toDayIso(date)
  const dayEnd = nextDayIso(date)
  const { data, error } = await supabase
    .from('room_blocks')
    .select('id, starts_at, ends_at')
    .eq('room_id', roomId)
    .eq('status', 'active')
    .lt('starts_at', dayEnd)
    .gt('ends_at', dayStart)
  if (error) throw error

  // Compara instantes, não texto: o PostgREST devolve `2026-10-05T00:00:00+00:00`
  // e `toISOString()` gera `2026-10-05T00:00:00.000Z` — como texto nunca
  // batiam, e todo desbloqueio caía no aviso de "bloqueio maior".
  const sameInstant = (a: string, b: string) => new Date(a).getTime() === new Date(b).getTime()
  const exact = (data ?? []).find(
    (b) => sameInstant(b.starts_at, dayStart) && sameInstant(b.ends_at, dayEnd),
  )
  if (!exact) {
    if ((data ?? []).length > 0) {
      throw new Error('Este dia faz parte de um bloqueio maior — cancele pela tela de Bloqueios.')
    }
    return // já estava desbloqueado
  }
  await cancelRoomBlock(pousadaId, exact.id, 'Desbloqueado pelo calendário de reservas.')
}

/** Expande os bloqueios ATIVOS de um quarto em datas civis individuais (para o calendário legado, que trabalha com lista de dias). */
export async function listBlockedCalendarDaysByPousada(
  pousadaId: string,
): Promise<{ roomId: string; date: string }[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('room_blocks')
    .select('room_id, starts_at, ends_at')
    .eq('pousada_id', pousadaId)
    .eq('status', 'active')
  if (error) throw error

  const out: { roomId: string; date: string }[] = []
  const seen = new Set<string>()
  for (const b of data ?? []) {
    const cursor = new Date(b.starts_at)
    const end = new Date(b.ends_at)
    while (cursor.getTime() < end.getTime()) {
      const date = cursor.toISOString().slice(0, 10)
      const key = `${b.room_id}|${date}`
      if (!seen.has(key)) {
        seen.add(key)
        out.push({ roomId: b.room_id, date })
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }
  }
  return out
}

export async function listBlockedCalendarDays(roomId: string): Promise<string[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('room_blocks')
    .select('starts_at, ends_at')
    .eq('room_id', roomId)
    .eq('status', 'active')
  if (error) throw error

  const days = new Set<string>()
  for (const b of data ?? []) {
    const cursor = new Date(b.starts_at)
    const end = new Date(b.ends_at)
    while (cursor.getTime() < end.getTime()) {
      days.add(cursor.toISOString().slice(0, 10))
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }
  }
  return [...days]
}

export async function cancelRoomBlock(
  pousadaId: string,
  blockId: string,
  cancellationReason: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc('cancel_room_block', {
    p_pousada_id: pousadaId,
    p_block_id: blockId,
    p_cancellation_reason: cancellationReason,
  })
  if (error) throw new Error(error.message)
}
