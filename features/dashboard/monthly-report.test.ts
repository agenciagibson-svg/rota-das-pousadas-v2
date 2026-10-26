import { describe, expect, it } from 'vitest'
import {
  addMonths,
  buildMonthlyReport,
  monthLabel,
  percentVariation,
  pointsVariation,
  reportMonthFor,
  summarizeMonth,
  type ReportBooking,
} from './monthly-report'
import { calculateOccupancy, countsAsStayRevenue, monthlyRevenue } from './metrics'

const b = (
  checkin: string,
  checkout: string,
  total: number,
  status: ReportBooking['status'] = 'checked_out',
  origin: ReportBooking['origin'] = 'rota_das_pousadas',
): ReportBooking => ({ checkin, checkout, total, status, origin })

// Setembro/2026 (30 dias) e agosto/2026 (31 dias), 2 quartos ativos.
const bookings: ReportBooking[] = [
  b('2026-09-10', '2026-09-12', 600), // 2 noites, site
  b('2026-09-29', '2026-10-02', 900, 'checked_out', 'airbnb'), // 3 noites; 2 em setembro
  b('2026-09-20', '2026-09-22', 500, 'cancelled', 'balcao'), // fora
  b('2026-09-05', '2026-09-06', 300, 'no_show', 'balcao'), // fora
  b('2026-09-15', '2026-09-16', 200, 'confirmed', 'link_bio'), // 1 noite
  b('2026-08-30', '2026-09-01', 400, 'checked_out', 'balcao'), // agosto; 2 noites em agosto
  b('2026-08-10', '2026-08-11', 150, 'checked_out', 'rota_das_pousadas'),
]

describe('meses do relatório', () => {
  it('relatório de dia 1º é do mês anterior, inclusive na virada do ano', () => {
    expect(reportMonthFor('2026-10-01')).toBe('2026-09-01')
    expect(reportMonthFor('2027-01-01')).toBe('2026-12-01')
    expect(reportMonthFor('2026-10-03')).toBe('2026-09-01')
  })

  it('soma meses e escreve o mês por extenso', () => {
    expect(addMonths('2026-12-01', 1)).toBe('2027-01-01')
    expect(addMonths('2026-01-01', -1)).toBe('2025-12-01')
    expect(monthLabel('2026-03-01')).toBe('março de 2026')
  })
})

describe('summarizeMonth — mesmos números do painel', () => {
  const sep = summarizeMonth(bookings, 2, '2026-09-01')

  it('ocupação é a de calculateOccupancy no mês, com a estadia concluída contando (mês fechado)', () => {
    const panel = calculateOccupancy(
      bookings,
      2,
      '2026-09-01',
      '2026-10-01',
      new Date(),
      countsAsStayRevenue,
    )
    expect(sep.occupiedNights).toBe(panel.occupiedNights)
    expect(sep.occupiedNights).toBe(2 + 2 + 1 + 0) // airbnb: 29 e 30; agosto: 0 em setembro
    expect(sep.availableNights).toBe(60)
    expect(sep.occupancyRate).toBe(Math.round((5 / 60) * 100))
  })

  it('receita é a do gráfico do painel para o mês (entrada no mês, sem cancelada/no-show)', () => {
    const series = monthlyRevenue(bookings, new Date('2026-10-01T12:00:00Z'), 2)
    expect(sep.revenue).toBe(series[0].value) // [setembro, outubro]
    expect(sep.revenue).toBe(600 + 900 + 200)
  })

  it('reservas, noites e diária média vêm das mesmas reservas da receita', () => {
    expect(sep.bookings).toBe(3)
    expect(sep.nights).toBe(2 + 3 + 1)
    expect(sep.averageDailyRate).toBe(Math.round(1700 / 6))
  })

  it('origens com o rótulo do painel, da maior para a menor', () => {
    expect(sep.origins).toEqual([
      { origin: 'airbnb', label: 'Airbnb', bookings: 1, revenue: 900 },
      { origin: 'rota_das_pousadas', label: 'Rota das Pousadas', bookings: 1, revenue: 600 },
      { origin: 'link_bio', label: 'Link da bio', bookings: 1, revenue: 200 },
    ])
  })

  it('mês sem reserva: tudo zero, sem divisão por zero', () => {
    const empty = summarizeMonth([], 3, '2026-02-01')
    expect(empty).toMatchObject({
      occupancyRate: 0,
      revenue: 0,
      bookings: 0,
      nights: 0,
      averageDailyRate: 0,
      availableNights: 84,
      origins: [],
    })
  })
})

describe('variações', () => {
  it('percentual com seta para cima, para baixo, igual e sem base', () => {
    expect(percentVariation(120, 100)).toEqual({ direction: 'up', label: '+20%' })
    expect(percentVariation(75, 100)).toEqual({ direction: 'down', label: '−25%' })
    expect(percentVariation(100, 100)).toEqual({ direction: 'same', label: 'igual' })
    expect(percentVariation(50, 0)).toEqual({ direction: 'new', label: 'sem base' })
    expect(percentVariation(0, 0)).toEqual({ direction: 'same', label: 'igual' })
  })

  it('ocupação compara em pontos percentuais', () => {
    expect(pointsVariation(52, 40)).toEqual({ direction: 'up', label: '+12 p.p.' })
    expect(pointsVariation(30, 33)).toEqual({ direction: 'down', label: '−3 p.p.' })
  })
})

describe('buildMonthlyReport', () => {
  it('compara setembro com agosto', () => {
    const r = buildMonthlyReport({
      pousadaName: 'Pousada Sol',
      bookings,
      totalRooms: 2,
      month: '2026-09-01',
    })
    expect(r.previous.month).toBe('2026-08-01')
    expect(r.previous.revenue).toBe(550)
    expect(r.previous.bookings).toBe(2)
    expect(r.variations.revenue).toEqual({ direction: 'up', label: '+209%' })
    expect(r.variations.bookings).toEqual({ direction: 'up', label: '+50%' })
    expect(r.hasActivity).toBe(true)
  })

  it('sem reserva nem noite ocupada no mês: sem movimento', () => {
    const r = buildMonthlyReport({
      pousadaName: 'Pousada Sol',
      bookings,
      totalRooms: 2,
      month: '2026-06-01',
    })
    expect(r.hasActivity).toBe(false)
  })

  it('estadia que começou no mês anterior e ocupou noites conta como movimento', () => {
    const r = buildMonthlyReport({
      pousadaName: 'Pousada Sol',
      bookings: [b('2026-05-30', '2026-06-03', 800)],
      totalRooms: 1,
      month: '2026-06-01',
    })
    expect(r.current.bookings).toBe(0)
    expect(r.current.occupiedNights).toBe(2)
    expect(r.hasActivity).toBe(true)
  })
})
