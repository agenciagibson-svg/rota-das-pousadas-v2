import 'server-only'
import { isSupabaseConfigured } from '@/lib/env'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { PriceCalendarDay } from '@/features/reservas/price-calendar'

/**
 * Diária "a partir de", vaga e estadia mínima por noite (0094,
 * `public_price_calendar`). A RPC é pública (anon) e só responde para pousada
 * publicada, com janela de no máximo 62 dias — o limite é do banco.
 *
 * Modo demonstração (sem banco): nenhuma noite conhecida; o calendário mostra
 * os dias sem preço e a reserva segue pelo caminho normal.
 */
export async function getPublicPriceCalendarRpc(p: {
  slug: string
  from: string
  to: string
  guests: number
  roomId?: string
}): Promise<PriceCalendarDay[]> {
  if (!isSupabaseConfigured()) return []
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc('public_price_calendar', {
    p_slug: p.slug,
    p_from: p.from,
    p_to: p.to,
    p_guests: p.guests,
    ...(p.roomId ? { p_room_id: p.roomId } : {}),
  })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({
    date: row.night,
    fromPrice: row.from_price === null ? null : Number(row.from_price),
    available: Boolean(row.available),
    minNights: Math.max(1, Number(row.min_nights ?? 1)),
  }))
}
