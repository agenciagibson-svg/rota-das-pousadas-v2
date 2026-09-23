/**
 * Métricas do painel do proprietário — puras, determinísticas e testáveis.
 *
 * Toda a aritmética do painel vive aqui, fora de componente, pelo mesmo motivo
 * de `features/gestao/calendar.ts` e `features/reservas/pricing.ts`: número que
 * o dono da pousada usa para decidir preço e equipe precisa ser verificável por
 * teste, não escrito à mão dentro do JSX.
 *
 * Regra de inventário: uma reserva ocupa quarto apenas nos status de
 * `isOccupyingStatus` (pending, confirmed, checked_in) — o mesmo conjunto da
 * EXCLUDE constraint de `0033` e da RPC `list_bookable_rooms` de `0041`. Datas
 * são tratadas em UTC a partir de strings `YYYY-MM-DD`, sem fuso local, para
 * que servidor e banco contem a mesma noite.
 */
import { isoDateInTimeZone } from '@/lib/dates'
import { isOccupyingStatus } from '@/features/reservas/status'
import type { BookingStatus } from '@/features/reservas/types'

const DAY_MS = 86_400_000

const MONTH_LABELS = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
] as const
const WEEK_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'] as const

/** Subconjunto mínimo de uma reserva que as métricas precisam. */
export type MetricBooking = {
  checkin: string
  checkout: string
  total: number
  status: BookingStatus
}

export type OccupancySnapshot = {
  /** Quartos vendáveis considerados no cálculo. */
  totalRooms: number
  /** Diárias efetivamente ocupadas na janela. */
  occupiedNights: number
  /** Diárias que existiam para vender na janela (quartos × dias). */
  availableNights: number
  /** Percentual inteiro de 0 a 100. */
  rate: number
  /** Quartos ocupados no dia de referência. */
  roomsOccupiedToday: number
}

export type MonthlyRevenuePoint = { label: string; value: number }

export type WeeklyDailies = { labels: string[]; data: number[]; total: number }

export type ReviewSummary = {
  total: number
  average: number
  distribution: { rating: number; count: number; percent: number }[]
}

function isoToUTC(iso: string): number {
  return new Date(`${iso}T00:00:00Z`).getTime()
}

/** Data ISO (YYYY-MM-DD) em UTC — nunca usa o fuso da máquina que renderiza. */
export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function addDays(iso: string, days: number): string {
  return toISODate(new Date(isoToUTC(iso) + days * DAY_MS))
}

/**
 * Noites de `[checkin, checkout)` que caem dentro de `[from, to)`. O dia do
 * check-out não conta como diária — é a mesma convenção de `expandOccupied`
 * em `features/gestao/calendar.ts`. Datas inválidas resultam em 0, nunca NaN.
 */
export function nightsWithin(checkin: string, checkout: string, from: string, to: string): number {
  const start = Math.max(isoToUTC(checkin), isoToUTC(from))
  const end = Math.min(isoToUTC(checkout), isoToUTC(to))
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0
  return Math.round((end - start) / DAY_MS)
}

/** Quantos quartos estão ocupados em uma data específica. */
export function roomsOccupiedOn(bookings: MetricBooking[], dayISO: string): number {
  return bookings.filter(
    (b) => isOccupyingStatus(b.status) && b.checkin <= dayISO && dayISO < b.checkout,
  ).length
}

/**
 * Ocupação real em `[from, to)`.
 *
 * `rate` é limitada a 100 porque `totalRooms` pode estar desatualizado (quarto
 * desativado com reserva ativa ainda em curso); `occupiedNights` continua
 * bruto, sem recorte, para que a divergência apareça em vez de sumir.
 */
export function calculateOccupancy(
  bookings: MetricBooking[],
  totalRooms: number,
  from: string,
  to: string,
  today = new Date(),
): OccupancySnapshot {
  const days = Math.max(0, Math.round((isoToUTC(to) - isoToUTC(from)) / DAY_MS))
  const rooms = Math.max(0, totalRooms)
  const availableNights = rooms * days
  const occupiedNights = bookings.reduce(
    (sum, b) =>
      sum + (isOccupyingStatus(b.status) ? nightsWithin(b.checkin, b.checkout, from, to) : 0),
    0,
  )
  const rate =
    availableNights > 0 ? Math.min(100, Math.round((occupiedNights / availableNights) * 100)) : 0
  return {
    totalRooms: rooms,
    occupiedNights,
    availableNights,
    rate,
    roomsOccupiedToday: roomsOccupiedOn(bookings, toISODate(today)),
  }
}

/**
 * Receita por mês nos últimos `months` meses, atribuída ao mês do check-in.
 *
 * Conta estadias que ocupam inventário e as já concluídas; canceladas e
 * no-show ficam de fora. É receita prevista da operação, não caixa recebido —
 * o valor efetivamente pago vive em `bookings.amount_received` e tem outra
 * pergunta a responder.
 */
export function monthlyRevenue(
  bookings: MetricBooking[],
  today = new Date(),
  months = 12,
): MonthlyRevenuePoint[] {
  const counted = bookings.filter((b) => isOccupyingStatus(b.status) || b.status === 'checked_out')
  const points: MonthlyRevenuePoint[] = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i, 1))
    const prefix = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    const value = counted.reduce(
      (sum, b) => (b.checkin.startsWith(prefix) ? sum + b.total : sum),
      0,
    )
    points.push({ label: MONTH_LABELS[d.getUTCMonth()], value })
  }
  return points
}

/** Diárias ocupadas por dia na semana corrente (segunda a domingo). */
export function weeklyDailies(bookings: MetricBooking[], today = new Date()): WeeklyDailies {
  const todayISO = toISODate(today)
  const weekday = new Date(`${todayISO}T00:00:00Z`).getUTCDay() // 0 = domingo
  const mondayOffset = (weekday + 6) % 7
  const data: number[] = []
  for (let i = 0; i < 7; i++) {
    data.push(roomsOccupiedOn(bookings, addDays(todayISO, i - mondayOffset)))
  }
  return { labels: [...WEEK_LABELS], data, total: data.reduce((sum, n) => sum + n, 0) }
}

/** Média, total e distribuição das avaliações reais da pousada. */
export function summarizeReviews(reviews: { rating: number }[]): ReviewSummary {
  const valid = reviews.filter((r) => Number.isFinite(r.rating) && r.rating >= 1 && r.rating <= 5)
  const total = valid.length
  const average =
    total > 0 ? Math.round((valid.reduce((sum, r) => sum + r.rating, 0) / total) * 10) / 10 : 0
  const distribution = [5, 4, 3, 2, 1].map((rating) => {
    const count = valid.filter((r) => Math.round(r.rating) === rating).length
    return { rating, count, percent: total > 0 ? Math.round((count / total) * 100) : 0 }
  })
  return { total, average, distribution }
}

/** Chegadas e saídas previstas para uma data — o que a recepção precisa ver primeiro. */
export function dayMovements<T extends MetricBooking>(
  bookings: T[],
  dayISO: string,
): { arrivals: T[]; departures: T[] } {
  const active = bookings.filter((b) => b.status !== 'cancelled' && b.status !== 'no_show')
  return {
    arrivals: active.filter((b) => b.checkin === dayISO),
    departures: active.filter((b) => b.checkout === dayISO),
  }
}

/**
 * "Hoje" da pousada, no formato que as funções deste arquivo esperam. A data
 * vem do fuso da pousada: `toISODate(new Date())` dava a data de UTC, que no
 * Brasil vira o dia seguinte às 21h — e o painel passava a mostrar as chegadas
 * de amanhã como se fossem de hoje. O meio-dia UTC mantém a mesma data em
 * qualquer conta de semana ou mês feita com os getters UTC acima.
 */
export function pousadaToday(now: Date, timeZone: string): { iso: string; date: Date } {
  const iso = isoDateInTimeZone(now, timeZone)
  return { iso, date: new Date(`${iso}T12:00:00Z`) }
}

/**
 * "Próximas reservas" do painel: entradas a partir de hoje, só nos status que
 * ocupam inventário, da mais próxima para a mais distante. Antes o painel pegava
 * as primeiras da lista geral — as de entrada mais antiga, inclusive canceladas
 * e já encerradas.
 */
export function upcomingReservations<T extends MetricBooking>(
  bookings: T[],
  todayISO: string,
  limit = 5,
): T[] {
  return bookings
    .filter((b) => isOccupyingStatus(b.status) && b.checkin >= todayISO)
    .sort((a, b) => a.checkin.localeCompare(b.checkin))
    .slice(0, limit)
}
