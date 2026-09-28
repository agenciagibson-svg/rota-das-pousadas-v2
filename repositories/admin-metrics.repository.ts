import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { nightsBetween } from '@/features/reservas/pricing'
import type {
  PlatformKpis,
  GmvMonthPoint,
  RegionBookingCount,
  PousadaPerformance,
} from '@/features/admin/types'

/** Reservas que contam como receita/ocupação real — nunca cotação/cancelada/no-show. */
const REVENUE_STATUSES = ['confirmed', 'checked_in', 'checked_out'] as const

function monthRange(offsetMonths = 0): { start: Date; end: Date } {
  const now = new Date()
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offsetMonths, 1))
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offsetMonths + 1, 1))
  return { start, end }
}

function pct(current: number, previous: number): number | null {
  if (previous <= 0) return null
  return Math.round(((current - previous) / previous) * 1000) / 10
}

/** KPIs do topo da Visão Geral — mês atual vs. mês anterior pro delta. */
export async function getPlatformKpis(): Promise<PlatformKpis> {
  const supabase = await createSupabaseServerClient()
  const thisMonth = monthRange(0)
  const lastMonth = monthRange(1)

  const [
    { data: bookingsThis },
    { data: bookingsLast },
    { count: activePousadas },
    { data: newHosts },
  ] = await Promise.all([
    supabase
      .from('bookings')
      .select('total, status')
      .in('status', REVENUE_STATUSES)
      .gte('created_at', thisMonth.start.toISOString())
      .lt('created_at', thisMonth.end.toISOString()),
    supabase
      .from('bookings')
      .select('total, status')
      .in('status', REVENUE_STATUSES)
      .gte('created_at', lastMonth.start.toISOString())
      .lt('created_at', lastMonth.end.toISOString()),
    supabase
      .from('pousadas')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'publicada'),
    supabase
      .from('memberships')
      .select('user_id')
      .eq('role', 'proprietario')
      .gte('created_at', thisMonth.start.toISOString())
      .lt('created_at', thisMonth.end.toISOString()),
  ])

  // GMV = bookings.total. Até 28/09/2026 somava bookings.fee (taxa de serviço), que é 0 desde
  // 13/09 (SERVICE_FEE_RATE = 0) — o volume aparecia zerado.
  // GMV: dinheiro que o hóspede pagou, vai integralmente pra pousada — NÃO é receita da Rota
  // (a receita real da Rota é a assinatura, ver docs/04_BUSINESS_ARCHITECTURE.md §9).
  const gmvThisMonth = (bookingsThis ?? []).reduce((sum, b) => sum + Number(b.total), 0)
  const gmvLastMonth = (bookingsLast ?? []).reduce((sum, b) => sum + Number(b.total), 0)

  return {
    gmvThisMonth,
    gmvDeltaPct: pct(gmvThisMonth, gmvLastMonth),
    activePousadas: activePousadas ?? 0,
    bookingsThisMonth: (bookingsThis ?? []).length,
    newHostsThisMonth: new Set((newHosts ?? []).map((m) => m.user_id)).size,
  }
}

/** GMV (volume processado, bookings.total) por mês — dinheiro do hóspede pra pousada, NÃO receita da Rota. */
export async function getGmvByMonth(months = 12): Promise<GmvMonthPoint[]> {
  const supabase = await createSupabaseServerClient()
  const { start } = monthRange(months - 1)
  const { data, error } = await supabase
    .from('bookings')
    .select('total, created_at')
    .in('status', REVENUE_STATUSES)
    .gte('created_at', start.toISOString())
  if (error) throw error

  const buckets = new Map<string, number>()
  for (let i = months - 1; i >= 0; i--) {
    const { start: monthStart } = monthRange(i)
    buckets.set(monthStart.toISOString().slice(0, 7), 0)
  }
  for (const row of data ?? []) {
    const key = row.created_at.slice(0, 7)
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + Number(row.total))
  }
  return [...buckets.entries()].map(([month, amount]) => ({ month, amount }))
}

/** Top 5 estados por número de reservas (todas, não só receita — volume operacional). */
export async function getBookingsByRegion(): Promise<RegionBookingCount[]> {
  const supabase = await createSupabaseServerClient()
  const { data: pousadaStates, error: pError } = await supabase.from('pousadas').select('id, state')
  if (pError) throw pError
  const stateByPousada = new Map((pousadaStates ?? []).map((p) => [p.id, p.state]))

  const { data: bookings, error } = await supabase.from('bookings').select('pousada_id')
  if (error) throw error

  const counts = new Map<string, number>()
  for (const b of bookings ?? []) {
    const state = stateByPousada.get(b.pousada_id)
    if (!state) continue
    counts.set(state, (counts.get(state) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([state, count]) => ({ state, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
}

/**
 * Aproximação de ocupação: noites de reservas reais no mês atual (checkin
 * dentro do mês) ÷ (quartos de pousadas publicadas × dias do mês). Não
 * considera bloqueios manuais nem reservas que atravessam a virada do mês —
 * é uma média da rede, não um número operacional preciso por pousada.
 */
export async function getOccupancyRate(): Promise<number> {
  const supabase = await createSupabaseServerClient()
  const { start, end } = monthRange(0)

  const [{ data: bookings, error: bError }, { data: publishedPousadas, error: pError }] =
    await Promise.all([
      supabase
        .from('bookings')
        .select('checkin, checkout')
        .in('status', REVENUE_STATUSES)
        .gte('checkin', start.toISOString().slice(0, 10))
        .lt('checkin', end.toISOString().slice(0, 10)),
      supabase.from('pousadas').select('id').eq('status', 'publicada'),
    ])
  if (bError) throw bError
  if (pError) throw pError

  const nightsBooked = (bookings ?? []).reduce(
    (sum, b) => sum + nightsBetween(b.checkin, b.checkout),
    0,
  )
  const pousadaIds = (publishedPousadas ?? []).map((p) => p.id)
  if (pousadaIds.length === 0) return 0

  const { count: roomCount, error: rError } = await supabase
    .from('rooms')
    .select('id', { count: 'exact', head: true })
    .in('pousada_id', pousadaIds)
  if (rError) throw rError

  const daysInMonth = Math.round((end.getTime() - start.getTime()) / 86_400_000)
  const capacity = (roomCount ?? 0) * daysInMonth
  if (capacity <= 0) return 0
  return Math.min(100, Math.round((nightsBooked / capacity) * 1000) / 10)
}
const PERFORMANCE_WINDOW_DAYS = 90
/** Carência pra anúncio novo antes de poder ser marcado como "sem resultado". */
const NO_RESULT_GRACE_DAYS = 30

/**
 * Desempenho por pousada (publicada) nos últimos 90 dias — GMV, nº de
 * reservas reais, ocupação aproximada e a flag `noResult` (zero reservas na
 * janela e publicada há mais de 30 dias). Mesma limitação de `getOccupancyRate`:
 * não considera bloqueios manuais nem reserva que atravessa a virada da
 * janela. `created_at` da pousada é usado como proxy de "há quanto tempo está
 * no ar" — não existe um campo separado de "quando virou publicada".
 */
export async function getPousadaPerformance(): Promise<PousadaPerformance[]> {
  const supabase = await createSupabaseServerClient()
  const now = new Date()
  const windowStart = new Date(now.getTime() - PERFORMANCE_WINDOW_DAYS * 86_400_000)

  const [{ data: pousadas, error: pError }, { data: bookings, error: bError }] = await Promise.all([
    supabase
      .from('pousadas')
      .select('id, slug, name, city, state, created_at')
      .eq('status', 'publicada'),
    supabase
      .from('bookings')
      .select('pousada_id, total, checkin, checkout')
      .in('status', REVENUE_STATUSES)
      .gte('checkin', windowStart.toISOString().slice(0, 10)),
  ])
  if (pError) throw pError
  if (bError) throw bError

  const pousadaList = pousadas ?? []
  if (pousadaList.length === 0) return []
  const pousadaIds = pousadaList.map((p) => p.id)

  const { data: rooms, error: rError } = await supabase
    .from('rooms')
    .select('id, pousada_id')
    .in('pousada_id', pousadaIds)
  if (rError) throw rError

  const roomCountByPousada = new Map<string, number>()
  for (const r of rooms ?? []) {
    roomCountByPousada.set(r.pousada_id, (roomCountByPousada.get(r.pousada_id) ?? 0) + 1)
  }

  const gmvByPousada = new Map<string, number>()
  const bookingsCountByPousada = new Map<string, number>()
  const nightsByPousada = new Map<string, number>()
  for (const b of bookings ?? []) {
    gmvByPousada.set(b.pousada_id, (gmvByPousada.get(b.pousada_id) ?? 0) + Number(b.total))
    bookingsCountByPousada.set(b.pousada_id, (bookingsCountByPousada.get(b.pousada_id) ?? 0) + 1)
    nightsByPousada.set(
      b.pousada_id,
      (nightsByPousada.get(b.pousada_id) ?? 0) + nightsBetween(b.checkin, b.checkout),
    )
  }

  return pousadaList.map((p) => {
    const bookingsCount = bookingsCountByPousada.get(p.id) ?? 0
    const roomCount = roomCountByPousada.get(p.id) ?? 0
    const capacity = roomCount * PERFORMANCE_WINDOW_DAYS
    const nights = nightsByPousada.get(p.id) ?? 0
    const occupancyRate =
      capacity > 0 ? Math.min(100, Math.round((nights / capacity) * 1000) / 10) : 0
    const createdDaysAgo = Math.floor(
      (now.getTime() - new Date(p.created_at).getTime()) / 86_400_000,
    )

    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      city: p.city,
      state: p.state,
      gmv: gmvByPousada.get(p.id) ?? 0,
      bookingsCount,
      occupancyRate,
      createdAt: p.created_at,
      noResult: bookingsCount === 0 && createdDaysAgo >= NO_RESULT_GRACE_DAYS,
    }
  })
}
