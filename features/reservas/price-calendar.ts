/**
 * Calendário com preço por dia (h6) — lógica pura, sem React e sem banco.
 *
 * Os números vêm prontos do servidor (`public_price_calendar`, 0094): a menor
 * diária livre de cada noite ("a partir de"), se há vaga e a estadia mínima.
 * Aqui só se monta o mês, se decide o que dá para clicar e qual seleção sai do
 * clique. O preço da temporada nunca é recalculado no navegador.
 *
 * Datas são civis (AAAA-MM-DD) e as contas são em UTC, como em `lib/dates`.
 * Cada dia representa a NOITE que começa nele (igual a `bookings.checkin`).
 */
import { PUBLIC_STAY_MAX_NIGHTS, addDaysToISODate, isoNightsBetween } from '@/lib/dates'

/** Uma noite como o servidor devolve. */
export type PriceCalendarDay = {
  date: string
  /** Menor diária entre as acomodações livres; `null` sem vaga. */
  fromPrice: number | null
  available: boolean
  /** Estadia mínima que vale para quem dorme nesta noite (1 sem regra). */
  minNights: number
}

/** Noites conhecidas, por data. Dia ausente = sem dado (carregando ou indisponível). */
export type PriceCalendarDays = Readonly<Record<string, PriceCalendarDay>>

export type CalendarSelection = { checkin: string; checkout: string }

/** `unknown`: o preço desse dia ainda não chegou (ou não veio) do servidor. */
export type CalendarCellStatus = 'past' | 'unavailable' | 'available' | 'unknown'

export type CalendarCell = {
  date: string
  day: number
  status: CalendarCellStatus
  price: number | null
  minNights: number
  /** Pode ser clicado agora (como entrada ou como saída, conforme a etapa). */
  selectable: boolean
  isCheckin: boolean
  isCheckout: boolean
  /** Noite dentro da estadia escolhida. */
  inRange: boolean
  /** Texto para leitor de tela: data, preço, mínimo e situação. */
  label: string
}

export type CalendarMonth = {
  /** AAAA-MM */
  month: string
  /** "Novembro de 2026" */
  title: string
  /** Semanas de domingo a sábado; `null` = dia de outro mês. */
  weeks: (CalendarCell | null)[][]
}

export const WEEKDAYS = [
  { short: 'D', long: 'domingo' },
  { short: 'S', long: 'segunda' },
  { short: 'T', long: 'terça' },
  { short: 'Q', long: 'quarta' },
  { short: 'Q', long: 'quinta' },
  { short: 'S', long: 'sexta' },
  { short: 'S', long: 'sábado' },
] as const

/** Até quantos meses à frente o calendário navega (o banco aceita ~2 anos). */
export const CALENDAR_MAX_MONTHS_AHEAD = 22

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function isMonth(value: unknown): value is string {
  return typeof value === 'string' && MONTH_RE.test(value)
}

export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

export function monthOf(date: string): string {
  return date.slice(0, 7)
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const next = new Date(Date.UTC(y, m - 1 + delta, 1))
  return next.toISOString().slice(0, 7)
}

/** Primeira noite do mês e o 1º do mês seguinte (fim exclusivo), para a consulta. */
export function monthRange(month: string): { from: string; to: string } {
  return { from: `${month}-01`, to: `${shiftMonth(month, 1)}-01` }
}

/** Meses que dá para ver: do mês de hoje até CALENDAR_MAX_MONTHS_AHEAD à frente. */
export function clampMonth(month: string, today: string): string {
  const first = monthOf(today)
  const last = shiftMonth(first, CALENDAR_MAX_MONTHS_AHEAD)
  if (!isMonth(month) || month < first) return first
  return month > last ? last : month
}

export function canGoToMonth(month: string, today: string): boolean {
  return clampMonth(month, today) === month
}

/** "Novembro de 2026". */
export function monthTitle(month: string): string {
  const title = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${month}-01T00:00:00Z`))
  return title.charAt(0).toUpperCase() + title.slice(1)
}

/** Diária curta para caber na célula: 450 · 1.200 · 12 mil. Sem "R$" (a legenda diz). */
export function formatCalendarPrice(value: number): string {
  if (value >= 10_000) return `${Math.round(value / 1000)} mil`
  return Math.round(value).toLocaleString('pt-BR')
}

function dayStatus(date: string, today: string, days: PriceCalendarDays): CalendarCellStatus {
  if (date < today) return 'past'
  const info = days[date]
  if (!info) return 'unknown'
  return info.available ? 'available' : 'unavailable'
}

/** A noite começa em `date` e alguém pode chegar nela? Sem dado ainda: deixa tentar. */
export function canCheckinOn(date: string, today: string, days: PriceCalendarDays): boolean {
  const status = dayStatus(date, today, days)
  return status === 'available' || status === 'unknown'
}

/**
 * Estadia mínima exigida para chegar em `checkin` e sair em `checkout`: a
 * maior entre as noites do período (mesma regra de `room_stay_quote`, 0087 —
 * chegar um dia antes do feriado não fura o mínimo do feriado).
 */
export function requiredMinNights(
  checkin: string,
  checkout: string,
  days: PriceCalendarDays,
): number {
  let required = 1
  for (let night = checkin; night < checkout; night = addDaysToISODate(night, 1)) {
    required = Math.max(required, days[night]?.minNights ?? 1)
  }
  return required
}

/**
 * Dá para sair em `date` tendo entrado em `checkin`? Todas as noites do meio
 * precisam ter vaga (o dia da saída em si pode estar ocupado — é a noite
 * seguinte), respeitando o mínimo e o teto de noites do site.
 *
 * Com várias acomodações, "tem vaga" é por noite: o servidor ainda confere se
 * a MESMA acomodação está livre o período todo quando cota a estadia.
 */
export function canCheckoutOn(
  checkin: string,
  date: string,
  today: string,
  days: PriceCalendarDays,
  maxNights: number = PUBLIC_STAY_MAX_NIGHTS,
): boolean {
  if (!checkin || date <= checkin) return false
  const nights = isoNightsBetween(checkin, date)
  if (nights > maxNights) return false
  for (let night = checkin; night < date; night = addDaysToISODate(night, 1)) {
    if (!canCheckinOn(night, today, days)) return false
  }
  return nights >= requiredMinNights(checkin, date, days)
}

/**
 * Escolhendo a saída: tem entrada e ainda não tem saída. Entrada que não dá
 * mais para usar (passou, ou lotou) não prende a pessoa: o próximo toque
 * escolhe outra entrada.
 */
export function isPickingCheckout(
  selection: CalendarSelection,
  today: string,
  days: PriceCalendarDays,
): boolean {
  return (
    Boolean(selection.checkin) &&
    !selection.checkout &&
    canCheckinOn(selection.checkin, today, days)
  )
}

/**
 * Seleção depois do clique em `date`:
 *  - sem entrada, ou com entrada e saída já escolhidas: o clique começa de novo
 *    (vira a entrada);
 *  - com entrada e sem saída: depois da entrada vira a saída (se der); antes
 *    dela, troca a entrada.
 * Clique que não pode ser aceito devolve a seleção como estava.
 */
export function nextSelection(
  selection: CalendarSelection,
  date: string,
  today: string,
  days: PriceCalendarDays,
  maxNights: number = PUBLIC_STAY_MAX_NIGHTS,
): CalendarSelection {
  const picking = isPickingCheckout(selection, today, days)
  if (picking && date > selection.checkin) {
    return canCheckoutOn(selection.checkin, date, today, days, maxNights)
      ? { checkin: selection.checkin, checkout: date }
      : selection
  }
  if (picking && date === selection.checkin) return selection
  return canCheckinOn(date, today, days) ? { checkin: date, checkout: '' } : selection
}

const LONG_DATE = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
})

function cellLabel(cell: Omit<CalendarCell, 'label'>): string {
  const parts = [LONG_DATE.format(new Date(`${cell.date}T00:00:00Z`))]
  if (cell.isCheckin) parts.push('entrada escolhida')
  if (cell.isCheckout) parts.push('saída escolhida')
  if (cell.status === 'past') parts.push('data passada')
  else if (cell.status === 'unavailable') parts.push('sem vaga')
  else if (cell.price !== null)
    parts.push(`a partir de R$ ${Math.round(cell.price).toLocaleString('pt-BR')}`)
  if (cell.minNights > 1 && cell.status === 'available') {
    parts.push(`estadia mínima de ${cell.minNights} noites`)
  }
  return parts.join(', ')
}

/** Monta o mês: células por semana com preço, situação e o que dá para clicar. */
export function buildCalendarMonth({
  month,
  days,
  today,
  selection,
  maxNights = PUBLIC_STAY_MAX_NIGHTS,
}: {
  month: string
  days: PriceCalendarDays
  today: string
  selection: CalendarSelection
  maxNights?: number
}): CalendarMonth {
  const { from, to } = monthRange(month)
  const firstWeekday = new Date(`${from}T00:00:00Z`).getUTCDay()
  const pickingCheckout = isPickingCheckout(selection, today, days)
  const cells: (CalendarCell | null)[] = Array.from({ length: firstWeekday }, () => null)

  for (let date = from; date < to; date = addDaysToISODate(date, 1)) {
    const status = dayStatus(date, today, days)
    const info = days[date]
    const asCheckin = canCheckinOn(date, today, days)
    const selectable = pickingCheckout
      ? date > selection.checkin
        ? canCheckoutOn(selection.checkin, date, today, days, maxNights)
        : asCheckin
      : asCheckin
    const base = {
      date,
      day: Number(date.slice(8)),
      status,
      price: status === 'available' ? (info?.fromPrice ?? null) : null,
      minNights: info?.minNights ?? 1,
      selectable,
      isCheckin: date === selection.checkin,
      isCheckout: date === selection.checkout,
      inRange: Boolean(
        selection.checkin &&
        selection.checkout &&
        date > selection.checkin &&
        date < selection.checkout,
      ),
    }
    cells.push({ ...base, label: cellLabel(base) })
  }
  while (cells.length % 7 !== 0) cells.push(null)

  const weeks: (CalendarCell | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return { month, title: monthTitle(month), weeks }
}

/** Frase curta abaixo do calendário, conforme a etapa da escolha. */
export function selectionHint(
  selection: CalendarSelection,
  today: string,
  days: PriceCalendarDays,
): string {
  if (!selection.checkin) return 'Toque no dia da entrada.'
  if (!selection.checkout) {
    if (!isPickingCheckout(selection, today, days)) {
      return 'Essa entrada não está mais disponível. Toque em outro dia.'
    }
    const min = days[selection.checkin]?.minNights ?? 1
    return min > 1
      ? `Agora toque no dia da saída. A partir dessa data, a estadia mínima é de ${min} noites.`
      : 'Agora toque no dia da saída.'
  }
  const nights = isoNightsBetween(selection.checkin, selection.checkout)
  return `${nights} ${nights === 1 ? 'noite' : 'noites'} escolhidas. Toque em outro dia para mudar.`
}

/** Linhas da RPC → mapa por data (o que o calendário consome). */
export function indexCalendarDays(rows: PriceCalendarDay[]): Record<string, PriceCalendarDay> {
  const map: Record<string, PriceCalendarDay> = {}
  for (const row of rows) map[row.date] = row
  return map
}
