import { describe, it, expect } from 'vitest'
import { buildMonthGrid, expandOccupied } from './calendar'

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
