/**
 * Motor de calendário (puro, testável) para a gestão de reservas.
 * Gera a grade de um mês marcando cada dia como livre, ocupado (reserva),
 * bloqueado (manutenção/indisponível) ou passado.
 */

export type DayStatus = 'past' | 'free' | 'booked' | 'blocked'

export type CalendarDay = {
  date: string // YYYY-MM-DD
  day: number
  inMonth: boolean
  status: DayStatus
}

export type DateRange = { checkin: string; checkout: string }

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Expande [checkin, checkout) em datas ocupadas (noites); o checkout fica livre. */
export function expandOccupied(ranges: DateRange[]): Set<string> {
  const out = new Set<string>()
  for (const r of ranges) {
    const start = new Date(`${r.checkin}T00:00:00Z`)
    const end = new Date(`${r.checkout}T00:00:00Z`)
    for (let d = new Date(start); d < end; d.setUTCDate(d.getUTCDate() + 1)) {
      out.add(toISO(d))
    }
  }
  return out
}

/**
 * Constrói a grade do mês (semanas de domingo a sábado, 6 linhas).
 * `year` completo, `month` 0-11.
 */
export function buildMonthGrid(
  year: number,
  month: number,
  occupied: Set<string>,
  blocked: Set<string>,
  today = new Date(),
): CalendarDay[] {
  const first = new Date(Date.UTC(year, month, 1))
  const startWeekday = first.getUTCDay() // 0 = domingo
  const gridStart = new Date(first)
  gridStart.setUTCDate(first.getUTCDate() - startWeekday)

  const todayISO = toISO(today)
  const days: CalendarDay[] = []

  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart)
    d.setUTCDate(gridStart.getUTCDate() + i)
    const iso = toISO(d)
    let status: DayStatus
    if (occupied.has(iso)) status = 'booked'
    else if (blocked.has(iso)) status = 'blocked'
    else if (iso < todayISO) status = 'past'
    else status = 'free'

    days.push({
      date: iso,
      day: d.getUTCDate(),
      inMonth: d.getUTCMonth() === month,
      status,
    })
  }

  return days
}
