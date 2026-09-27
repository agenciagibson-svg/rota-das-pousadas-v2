import { describe, it, expect } from 'vitest'
import { buildMonthGrid, expandOccupied, buildPousadaMonthGrid } from './calendar'

describe('expandOccupied', () => {
  it('ocupa as noites e libera o dia de checkout', () => {
    const set = expandOccupied([{ checkin: '2026-03-14', checkout: '2026-03-16' }])
    expect(set.has('2026-03-14')).toBe(true)
    expect(set.has('2026-03-15')).toBe(true)
    expect(set.has('2026-03-16')).toBe(false) // checkout livre
  })
})

describe('buildMonthGrid', () => {
  it('gera 42 dias (6 semanas)', () => {
    const grid = buildMonthGrid(2026, 2, new Set(), new Set(), new Date('2026-03-01T00:00:00Z'))
    expect(grid).toHaveLength(42)
  })

  it('marca ocupado, bloqueado, livre e passado', () => {
    const occupied = expandOccupied([{ checkin: '2026-03-14', checkout: '2026-03-16' }])
    const blocked = new Set(['2026-03-20'])
    const grid = buildMonthGrid(2026, 2, occupied, blocked, new Date('2026-03-10T00:00:00Z'))
    const byDate = new Map(grid.map((d) => [d.date, d]))
    expect(byDate.get('2026-03-14')?.status).toBe('booked')
    expect(byDate.get('2026-03-20')?.status).toBe('blocked')
    expect(byDate.get('2026-03-12')?.status).toBe('free')
    expect(byDate.get('2026-03-05')?.status).toBe('past')
  })

  it('sinaliza dias fora do mês', () => {
    const grid = buildMonthGrid(2026, 2, new Set(), new Set(), new Date('2026-03-01T00:00:00Z'))
    expect(grid.some((d) => !d.inMonth)).toBe(true)
    expect(grid.filter((d) => d.inMonth)).toHaveLength(31) // março tem 31 dias
  })
})

describe('buildPousadaMonthGrid (todos os quartos)', () => {
  const today = new Date('2026-10-01T12:00:00Z')
  const rooms = ['a', 'b', 'c']
  const day = (grid: ReturnType<typeof buildPousadaMonthGrid>, iso: string) =>
    grid.find((d) => d.date === iso)!

  it('parcial quando só parte dos quartos está ocupada', () => {
    const g = buildPousadaMonthGrid(
      2026,
      9,
      rooms,
      [{ roomId: 'a', checkin: '2026-10-10', checkout: '2026-10-12' }],
      [],
      today,
    )
    expect(day(g, '2026-10-10')).toMatchObject({ status: 'partial', busyRooms: 1, totalRooms: 3 })
    expect(day(g, '2026-10-12').status).toBe('free')
  })
  it('lotado quando todos ocupados ou bloqueados (com alguma reserva)', () => {
    const g = buildPousadaMonthGrid(
      2026,
      9,
      rooms,
      [
        { roomId: 'a', checkin: '2026-10-10', checkout: '2026-10-11' },
        { roomId: 'b', checkin: '2026-10-10', checkout: '2026-10-11' },
      ],
      [{ roomId: 'c', date: '2026-10-10' }],
      today,
    )
    expect(day(g, '2026-10-10').status).toBe('booked')
  })
  it('bloqueado quando todos os quartos estão bloqueados', () => {
    const g = buildPousadaMonthGrid(
      2026,
      9,
      rooms,
      [],
      rooms.map((r) => ({ roomId: r, date: '2026-10-15' })),
      today,
    )
    expect(day(g, '2026-10-15').status).toBe('blocked')
  })
  it('dia passado com ocupação parcial continua como passado', () => {
    const g = buildPousadaMonthGrid(
      2026,
      9,
      rooms,
      [{ roomId: 'a', checkin: '2026-09-28', checkout: '2026-09-29' }],
      [],
      today,
    )
    expect(day(g, '2026-09-28').status).toBe('past')
  })
})
