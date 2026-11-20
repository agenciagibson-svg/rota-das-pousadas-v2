import 'server-only'
import { getCurrentUser } from '@/features/auth/services/auth.service'
import { isSupabaseConfigured } from '@/lib/env'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { listMyBookingRows } from '@/repositories/bookings.repository'
import { demoMyStays } from '@/features/estadia/demo'
import { resolveAppState, type AppState, type PhaseBooking } from '../phase'

const EMPTY: AppState = { phase: { kind: 'loja' }, pending: [], upcoming: [] }

/**
 * Fase do app para o usuário logado. Sem login: loja. As reservas vêm da RPC
 * `list_my_bookings` (só as do próprio usuário); da pousada, só colunas
 * públicas (nome, slug, horário de check-out e fuso).
 */
export async function getMyAppState(now: Date = new Date()): Promise<AppState> {
  if (!isSupabaseConfigured()) {
    // Demonstração (preview sem Supabase): a estadia de exemplo em curso.
    const stays = await demoMyStays()
    return resolveAppState(
      stays.map((s) => ({
        id: s.id,
        code: s.code,
        status: s.status,
        checkin: s.checkin,
        checkout: s.checkout,
        pousadaName: s.pousadaName,
        pousadaSlug: 'refugio-das-nuvens',
        checkoutTime: '12:00',
        timezone: '',
        paymentDueAt: null,
      })),
      now,
    )
  }
  const user = await getCurrentUser()
  if (!user) return EMPTY

  const rows = await listMyBookingRows()
  if (rows.length === 0) return EMPTY
  const supabase = await createSupabaseServerClient()
  const ids = [...new Set(rows.map((r) => r.pousada_id))]
  const { data: pousadas } = await supabase
    .from('pousadas')
    .select('id, slug, name, checkout_time, timezone')
    .in('id', ids)
  const byId = new Map((pousadas ?? []).map((p) => [p.id, p]))

  const bookings: PhaseBooking[] = rows.map((r) => {
    const p = byId.get(r.pousada_id)
    return {
      id: r.id,
      code: r.code,
      status: r.status,
      checkin: r.checkin,
      checkout: r.checkout,
      pousadaName: p?.name ?? 'Pousada',
      pousadaSlug: p?.slug ?? '',
      checkoutTime: p?.checkout_time ?? '',
      timezone: p?.timezone ?? '',
      paymentDueAt: r.payment_due_at,
    }
  })
  return resolveAppState(bookings, now)
}
