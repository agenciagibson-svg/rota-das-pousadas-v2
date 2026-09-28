import 'server-only'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  REVENUE_STATUSES,
  periodWindows,
  type ReportBooking,
  type ReportInput,
  type ReportPeriod,
  type ReportPousada,
  type ReportReview,
} from '@/features/admin/report-metrics'

/** O Supabase devolve no máximo 1000 linhas por consulta: busca em páginas até acabar. */
const PAGE = 1000
const MAX_ROWS = 50_000

async function fetchAll<T>(
  query: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await query(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    const rows = data ?? []
    out.push(...rows)
    if (rows.length < PAGE) break
  }
  return out
}

type BookingRow = {
  pousada_id: string
  status: string
  origin: string
  total: number
  checkin: string
  checkout: string
  created_at: string
}

const toBooking = (b: BookingRow): ReportBooking => ({
  pousadaId: b.pousada_id,
  status: b.status,
  origin: b.origin,
  total: Number(b.total) || 0,
  checkin: b.checkin,
  checkout: b.checkout,
  createdAt: b.created_at,
})

/** Linhas cruas da tela Relatórios (o cálculo fica em features/admin/report-metrics.ts). */
export async function loadReportInput(period: ReportPeriod): Promise<ReportInput> {
  const supabase = await createSupabaseServerClient()
  const { current, previous } = periodWindows(period)
  const fromIso = previous.start.toISOString()
  const fromDay = previous.start.toISOString().slice(0, 10)
  const toDay = current.end.toISOString().slice(0, 10)
  const cols = 'pousada_id, status, origin, total, checkin, checkout, created_at'

  const [sales, stays, pousadas, rooms, reviews] = await Promise.all([
    fetchAll<BookingRow>((a, b) =>
      supabase
        .from('bookings')
        .select(cols)
        .gte('created_at', fromIso)
        .order('created_at', { ascending: true })
        .range(a, b),
    ),
    fetchAll<BookingRow>((a, b) =>
      supabase
        .from('bookings')
        .select(cols)
        .in('status', REVENUE_STATUSES)
        .lt('checkin', toDay)
        .gt('checkout', fromDay)
        .order('checkin', { ascending: true })
        .range(a, b),
    ),
    fetchAll<{
      id: string
      slug: string
      name: string
      city: string
      state: string
      status: string
      created_at: string
    }>((a, b) =>
      supabase
        .from('pousadas')
        .select('id, slug, name, city, state, status, created_at')
        .order('name')
        .range(a, b),
    ),
    fetchAll<{ pousada_id: string }>((a, b) =>
      supabase
        .from('rooms')
        .select('pousada_id')
        .eq('status', 'active')
        .order('pousada_id')
        .range(a, b),
    ),
    fetchAll<{ pousada_id: string; rating: number; created_at: string }>((a, b) =>
      supabase
        .from('reviews')
        .select('pousada_id, rating, created_at')
        .order('created_at')
        .range(a, b),
    ),
  ])

  const roomsByPousada: Record<string, number> = {}
  for (const r of rooms) roomsByPousada[r.pousada_id] = (roomsByPousada[r.pousada_id] ?? 0) + 1

  return {
    period,
    sales: sales.map(toBooking),
    stays: stays.map(toBooking),
    pousadas: pousadas.map((p): ReportPousada => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      city: p.city,
      state: p.state,
      status: p.status,
      createdAt: p.created_at,
    })),
    roomsByPousada,
    reviews: reviews.map((r): ReportReview => ({
      pousadaId: r.pousada_id,
      rating: Number(r.rating) || 0,
      createdAt: r.created_at,
    })),
  }
}
