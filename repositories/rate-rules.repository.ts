import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { RateRule } from '@/features/acomodacoes/types'

/**
 * Regras de tarifa (0087). Leitura e escrita pela RLS de `rate_rules`
 * (dono/gestor escrevem; recepção lê). O preço da reserva pública é calculado
 * no banco (`room_stay_quote`), nunca a partir do que este módulo devolve.
 */
type RateRuleRow = {
  id: string
  name: string
  room_id: string | null
  first_night: string
  last_night: string
  weekdays: number[] | null
  kind: string
  value: number | string
  min_nights: number | null
  active: boolean
  rooms: { name: string } | { name: string }[] | null
}

function roomName(v: RateRuleRow['rooms']): string | null {
  if (!v) return null
  return Array.isArray(v) ? (v[0]?.name ?? null) : v.name
}

export type RateRuleWrite = {
  pousadaId: string
  name: string
  roomId: string | null
  firstNight: string
  lastNight: string
  weekdays: number[] | null
  kind: 'fixed' | 'percent'
  value: number
  minNights: number | null
  active: boolean
}

export async function listRateRulesByPousada(pousadaId: string): Promise<RateRule[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('rate_rules')
    .select(
      'id, name, room_id, first_night, last_night, weekdays, kind, value, min_nights, active, rooms(name)',
    )
    .eq('pousada_id', pousadaId)
    .order('first_night', { ascending: true })
  if (error) throw error
  return ((data ?? []) as unknown as RateRuleRow[]).map((r) => ({
    id: r.id,
    name: r.name,
    roomId: r.room_id,
    roomName: roomName(r.rooms),
    firstNight: r.first_night,
    lastNight: r.last_night,
    weekdays: r.weekdays,
    kind: r.kind === 'percent' ? 'percent' : 'fixed',
    value: Number(r.value),
    minNights: r.min_nights,
    active: r.active,
  }))
}

function toRow(w: RateRuleWrite) {
  return {
    pousada_id: w.pousadaId,
    name: w.name,
    room_id: w.roomId,
    first_night: w.firstNight,
    last_night: w.lastNight,
    weekdays: w.weekdays,
    kind: w.kind,
    value: w.value,
    min_nights: w.minNights,
    active: w.active,
  }
}

export async function insertRateRule(w: RateRuleWrite): Promise<{ id: string }> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.from('rate_rules').insert(toRow(w)).select('id').single()
  if (error) throw error
  return { id: data.id }
}

/** Atualiza só dentro da pousada ativa; 0 linhas = regra de outra pousada ou inexistente. */
export async function updateRateRule(id: string, w: RateRuleWrite): Promise<boolean> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('rate_rules')
    .update(toRow(w))
    .eq('id', id)
    .eq('pousada_id', w.pousadaId)
    .select('id')
  if (error) throw error
  return (data ?? []).length > 0
}

export async function deleteRateRule(id: string, pousadaId: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('rate_rules')
    .delete()
    .eq('id', id)
    .eq('pousada_id', pousadaId)
    .select('id')
  if (error) throw error
  return (data ?? []).length > 0
}

export type CounterStayQuote = { total: number; nights: number; minNights: number }

/**
 * Cotação da estadia com as tarifas de temporada (0087, `quote_room_stay`):
 * o banco confere se a conta tem acesso à pousada da acomodação.
 */
export async function quoteRoomStay(
  roomId: string,
  checkin: string,
  checkout: string,
): Promise<CounterStayQuote | null> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('quote_room_stay', {
    p_room_id: roomId,
    p_checkin: checkin,
    p_checkout: checkout,
  })
  if (error) throw new Error(error.message)
  const row = Array.isArray(data) ? data[0] : null
  if (!row) return null
  return { total: Number(row.total), nights: Number(row.nights), minNights: Number(row.min_nights) }
}
