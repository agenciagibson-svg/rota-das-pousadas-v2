/**
 * Motor de calendário (puro, testável) para a gestão de reservas.
 * Gera a grade de um mês marcando cada dia como livre, ocupado (reserva),
 * bloqueado (manutenção/indisponível) ou passado.
 */

export type DayStatus = 'past' | 'free' | 'booked' | 'blocked' | 'partial'

export type CalendarDay = {
  date: string // YYYY-MM-DD
  day: number
  inMonth: boolean
  status: DayStatus
  /** Visão "todos os quartos": quantos quartos estão ocupados/bloqueados no dia. */
  busyRooms?: number
  totalRooms?: number
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

export type RoomDay = { roomId: string; date: string }

/**
 * Situação de cada dia somando TODOS os quartos:
 * - booked: todos os quartos ocupados (reserva e/ou bloqueio), com ao menos uma reserva;
 * - blocked: todos bloqueados, nenhuma reserva;
 * - partial: parte dos quartos ocupada/bloqueada;
 * - free: nenhum quarto ocupado nem bloqueado.
 */
export function buildPousadaMonthGrid(
  year: number,
  month: number,
  roomIds: string[],
  bookings: (DateRange & { roomId: string })[],
  blocks: RoomDay[],
  today = new Date(),
): CalendarDay[] {
  const booked = new Map<string, Set<string>>()
  for (const b of bookings) {
    for (const d of expandOccupied([b])) {
      if (!booked.has(d)) booked.set(d, new Set())
      booked.get(d)!.add(b.roomId)
    }
  }
  const blockedByDay = new Map<string, Set<string>>()
  for (const b of blocks) {
    if (!blockedByDay.has(b.date)) blockedByDay.set(b.date, new Set())
    blockedByDay.get(b.date)!.add(b.roomId)
  }
  const total = roomIds.length
  const base = buildMonthGrid(year, month, new Set(), new Set(), today)
  return base.map((day) => {
    const bookedRooms = roomIds.filter((id) => booked.get(day.date)?.has(id))
    const blockedRooms = roomIds.filter(
      (id) => !bookedRooms.includes(id) && blockedByDay.get(day.date)?.has(id),
    )
    const busy = bookedRooms.length + blockedRooms.length
    let status: DayStatus = day.status
    if (total > 0 && busy === total) status = bookedRooms.length > 0 ? 'booked' : 'blocked'
    else if (busy > 0) status = day.status === 'past' ? 'past' : 'partial'
    return { ...day, status, busyRooms: busy, totalRooms: total }
  })
}
