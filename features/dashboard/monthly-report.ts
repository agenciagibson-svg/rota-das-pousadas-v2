/**
 * Relatório do mês enviado por e-mail ao dono da pousada (0097) — puro e
 * testável, no mesmo espírito de `metrics.ts`.
 *
 * Nenhuma métrica nova: cada número sai das mesmas funções do painel.
 * - Ocupação: `calculateOccupancy` (noites ocupadas no mês ÷ quartos × dias),
 *   com os quartos ativos da pousada. Como o mês já fechou, a estadia
 *   concluída conta como noite ocupada (no painel, que olha para a frente,
 *   ela ainda não existe) — o mesmo conjunto de reservas da receita.
 * - Receita: `monthlyRevenue` — soma do valor das estadias com entrada no mês,
 *   pendentes/confirmadas/hospedadas/concluídas (o gráfico "Receita" do painel).
 * - Reservas, noites, diária média e origens: as MESMAS reservas que compõem a
 *   receita (`countsAsStayRevenue` + entrada no mês). Diária média = receita ÷
 *   noites dessas reservas.
 */
import { isoNightsBetween } from '@/lib/dates'
import { ORIGIN_LABEL } from '@/features/gestao/components/origin-labels'
import type { BookingOrigin } from '@/features/reservas/types'
import {
  calculateOccupancy,
  countsAsStayRevenue,
  monthlyRevenue,
  type MetricBooking,
} from './metrics'

const MONTH_NAMES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
] as const

export type ReportBooking = MetricBooking & { origin: BookingOrigin }

export type OriginLine = {
  origin: BookingOrigin
  label: string
  bookings: number
  revenue: number
}

export type MonthSummary = {
  /** Primeiro dia do mês (YYYY-MM-01). */
  month: string
  totalRooms: number
  /** Percentual inteiro de 0 a 100 (mesma conta do painel). */
  occupancyRate: number
  occupiedNights: number
  availableNights: number
  revenue: number
  /** Reservas com entrada no mês que contam na receita. */
  bookings: number
  /** Noites dessas reservas. */
  nights: number
  /** Receita ÷ noites, em reais inteiros (0 sem noites). */
  averageDailyRate: number
  /** Da origem com mais reservas para a com menos. */
  origins: OriginLine[]
}

export type Variation = {
  direction: 'up' | 'down' | 'same' | 'new'
  /** "+12%", "−3 p.p.", "igual", "sem base". */
  label: string
}

export type MonthlyReport = {
  pousadaName: string
  current: MonthSummary
  previous: MonthSummary
  variations: {
    occupancy: Variation
    revenue: Variation
    averageDailyRate: Variation
    bookings: Variation
    nights: Variation
  }
  /** Teve reserva com entrada no mês ou noite ocupada? */
  hasActivity: boolean
}

/** Primeiro dia do mês de uma data ISO. */
export function monthStartOf(isoDate: string): string {
  return `${isoDate.slice(0, 7)}-01`
}

/** Soma meses a um primeiro-dia-do-mês (YYYY-MM-01). */
export function addMonths(monthStart: string, months: number): string {
  const [y, m] = monthStart.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + months, 1))
  return d.toISOString().slice(0, 10)
}

/** Mês do relatório: o mês anterior ao dia informado (data local, YYYY-MM-DD). */
export function reportMonthFor(todayISO: string): string {
  return addMonths(monthStartOf(todayISO), -1)
}

/** "setembro de 2026". */
export function monthLabel(monthStart: string): string {
  const [y, m] = monthStart.split('-').map(Number)
  return `${MONTH_NAMES[m - 1]} de ${y}`
}

/** "setembro". */
export function monthName(monthStart: string): string {
  return MONTH_NAMES[Number(monthStart.slice(5, 7)) - 1]
}

export function summarizeMonth(
  bookings: ReportBooking[],
  totalRooms: number,
  month: string,
): MonthSummary {
  const next = addMonths(month, 1)
  const prefix = month.slice(0, 7)
  // Mês fechado: a estadia concluída também ocupou a noite (ver calculateOccupancy).
  const occupancy = calculateOccupancy(
    bookings,
    totalRooms,
    month,
    next,
    new Date(`${month}T12:00:00Z`),
    countsAsStayRevenue,
  )
  // O gráfico do painel, recortado para um mês só: hoje = meio do mês.
  const revenue = monthlyRevenue(bookings, new Date(`${prefix}-15T12:00:00Z`), 1)[0]?.value ?? 0
  const inMonth = bookings.filter(
    (b) => countsAsStayRevenue(b.status) && b.checkin.startsWith(prefix),
  )
  const nights = inMonth.reduce(
    (sum, b) => sum + Math.max(0, isoNightsBetween(b.checkin, b.checkout)),
    0,
  )

  const byOrigin = new Map<BookingOrigin, OriginLine>()
  for (const b of inMonth) {
    const line = byOrigin.get(b.origin) ?? {
      origin: b.origin,
      label: ORIGIN_LABEL[b.origin] ?? b.origin,
      bookings: 0,
      revenue: 0,
    }
    line.bookings += 1
    line.revenue += b.total
    byOrigin.set(b.origin, line)
  }
  const origins = [...byOrigin.values()].sort(
    (a, b) => b.bookings - a.bookings || b.revenue - a.revenue || a.label.localeCompare(b.label),
  )

  return {
    month,
    totalRooms: occupancy.totalRooms,
    occupancyRate: occupancy.rate,
    occupiedNights: occupancy.occupiedNights,
    availableNights: occupancy.availableNights,
    revenue,
    bookings: inMonth.length,
    nights,
    averageDailyRate: nights > 0 ? Math.round(revenue / nights) : 0,
    origins,
  }
}

const MINUS = '−'

/** Variação percentual de um valor (receita, reservas, noites, diária). */
export function percentVariation(current: number, previous: number): Variation {
  if (previous === 0) {
    return current === 0
      ? { direction: 'same', label: 'igual' }
      : { direction: 'new', label: 'sem base' }
  }
  const pct = Math.round(((current - previous) / previous) * 100)
  if (pct === 0) return { direction: 'same', label: 'igual' }
  return pct > 0
    ? { direction: 'up', label: `+${pct}%` }
    : { direction: 'down', label: `${MINUS}${Math.abs(pct)}%` }
}

/** Variação em pontos percentuais (ocupação: 40% → 52% = +12 p.p.). */
export function pointsVariation(current: number, previous: number): Variation {
  const diff = current - previous
  if (diff === 0) return { direction: 'same', label: 'igual' }
  return diff > 0
    ? { direction: 'up', label: `+${diff} p.p.` }
    : { direction: 'down', label: `${MINUS}${Math.abs(diff)} p.p.` }
}

/**
 * Monta o relatório de `month` comparando com o mês anterior. `bookings` deve
 * cobrir os dois meses (a RPC `list_monthly_report_bookings` devolve o que
 * cruza a janela). A mesma quantidade de quartos vale para os dois meses — o
 * banco não guarda histórico de quarto ativo.
 */
export function buildMonthlyReport(params: {
  pousadaName: string
  bookings: ReportBooking[]
  totalRooms: number
  month: string
}): MonthlyReport {
  const current = summarizeMonth(params.bookings, params.totalRooms, params.month)
  const previous = summarizeMonth(params.bookings, params.totalRooms, addMonths(params.month, -1))
  return {
    pousadaName: params.pousadaName,
    current,
    previous,
    variations: {
      occupancy: pointsVariation(current.occupancyRate, previous.occupancyRate),
      revenue: percentVariation(current.revenue, previous.revenue),
      averageDailyRate: percentVariation(current.averageDailyRate, previous.averageDailyRate),
      bookings: percentVariation(current.bookings, previous.bookings),
      nights: percentVariation(current.nights, previous.nights),
    },
    hasActivity: current.bookings > 0 || current.occupiedNights > 0,
  }
}
