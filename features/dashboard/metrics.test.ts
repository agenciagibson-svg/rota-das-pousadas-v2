import { describe, expect, it } from 'vitest'
import type { BookingStatus } from '@/features/reservas/types'
import {
  addDays,
  calculateOccupancy,
  dayMovements,
  isAwaitingArrival,
  monthlyRevenue,
  nightsWithin,
  pousadaToday,
  roomsOccupiedOn,
  summarizeReviews,
  toISODate,
  upcomingReservations,
  weeklyDailies,
  type MetricBooking,
} from './metrics'

function booking(
  checkin: string,
  checkout: string,
  status: BookingStatus = 'confirmed',
  total = 0,
): MetricBooking {
  return { checkin, checkout, status, total }
}

// Quarta-feira, para exercitar a semana começando na segunda.
const TODAY = new Date('2026-09-16T09:30:00Z')

describe('nightsWithin', () => {
  it('conta só as noites dentro da janela', () => {
    expect(nightsWithin('2026-09-10', '2026-09-20', '2026-09-14', '2026-09-17')).toBe(3)
  })
  it('não conta o dia do check-out como diária', () => {
    expect(nightsWithin('2026-09-14', '2026-09-15', '2026-09-01', '2026-10-01')).toBe(1)
  })
  it('retorna 0 quando não há sobreposição ou a data é inválida', () => {
    expect(nightsWithin('2026-09-01', '2026-09-03', '2026-09-10', '2026-09-20')).toBe(0)
    expect(nightsWithin('data-ruim', '2026-09-03', '2026-09-01', '2026-09-20')).toBe(0)
  })
})

describe('roomsOccupiedOn', () => {
  const bookings = [
    booking('2026-09-14', '2026-09-18'),
    booking('2026-09-16', '2026-09-17', 'checked_in'),
    booking('2026-09-16', '2026-09-20', 'cancelled'),
    booking('2026-09-16', '2026-09-19', 'pending'),
  ]
  it('conta apenas status que ocupam inventário', () => {
    expect(roomsOccupiedOn(bookings, '2026-09-16')).toBe(3)
  })
  it('libera o quarto no dia do check-out', () => {
    expect(roomsOccupiedOn([booking('2026-09-14', '2026-09-16')], '2026-09-16')).toBe(0)
  })
})

describe('calculateOccupancy', () => {
  it('calcula a taxa sobre quartos × dias', () => {
    // 2 reservas de 5 noites em 4 quartos × 10 dias = 10/40.
    const snapshot = calculateOccupancy(
      [booking('2026-09-10', '2026-09-15'), booking('2026-09-10', '2026-09-15')],
      4,
      '2026-09-10',
      '2026-09-20',
      TODAY,
    )
    expect(snapshot.occupiedNights).toBe(10)
    expect(snapshot.availableNights).toBe(40)
    expect(snapshot.rate).toBe(25)
  })
  it('não inventa ocupação sem quarto cadastrado', () => {
    const snapshot = calculateOccupancy(
      [booking('2026-09-10', '2026-09-15')],
      0,
      '2026-09-10',
      '2026-09-20',
      TODAY,
    )
    expect(snapshot.availableNights).toBe(0)
    expect(snapshot.rate).toBe(0)
  })
  it('limita a taxa a 100 mas preserva as diárias brutas', () => {
    const snapshot = calculateOccupancy(
      [booking('2026-09-10', '2026-09-20'), booking('2026-09-10', '2026-09-20')],
      1,
      '2026-09-10',
      '2026-09-20',
      TODAY,
    )
    expect(snapshot.occupiedNights).toBe(20)
    expect(snapshot.availableNights).toBe(10)
    expect(snapshot.rate).toBe(100)
  })
  it('ignora canceladas e no-show', () => {
    const snapshot = calculateOccupancy(
      [
        booking('2026-09-10', '2026-09-15', 'cancelled'),
        booking('2026-09-10', '2026-09-15', 'no_show'),
      ],
      2,
      '2026-09-10',
      '2026-09-20',
      TODAY,
    )
    expect(snapshot.occupiedNights).toBe(0)
  })
})

describe('monthlyRevenue', () => {
  it('atribui a receita ao mês do check-in e devolve 12 pontos', () => {
    const points = monthlyRevenue(
      [
        booking('2026-09-02', '2026-09-04', 'confirmed', 900),
        booking('2026-09-20', '2026-09-22', 'checked_out', 600),
        booking('2026-08-10', '2026-08-12', 'confirmed', 400),
      ],
      TODAY,
    )
    expect(points).toHaveLength(12)
    expect(points[11]).toEqual({ label: 'set', value: 1500 })
    expect(points[10]).toEqual({ label: 'ago', value: 400 })
  })
  it('não conta cancelada nem no-show', () => {
    const points = monthlyRevenue(
      [
        booking('2026-09-02', '2026-09-04', 'cancelled', 900),
        booking('2026-09-05', '2026-09-06', 'no_show', 300),
      ],
      TODAY,
    )
    expect(points[11].value).toBe(0)
  })
  it('devolve zeros quando não há reserva alguma', () => {
    expect(monthlyRevenue([], TODAY).every((p) => p.value === 0)).toBe(true)
  })
})

describe('weeklyDailies', () => {
  it('abre a semana na segunda-feira da data de referência', () => {
    // TODAY = quarta 16/09/2026 → semana de 14/09 (seg) a 20/09 (dom).
    const week = weeklyDailies([booking('2026-09-14', '2026-09-16')], TODAY)
    expect(week.labels[0]).toBe('Seg')
    expect(week.data).toEqual([1, 1, 0, 0, 0, 0, 0])
    expect(week.total).toBe(2)
  })
  it('soma quartos simultâneos no mesmo dia', () => {
    const week = weeklyDailies(
      [booking('2026-09-16', '2026-09-17'), booking('2026-09-16', '2026-09-17')],
      TODAY,
    )
    expect(week.data[2]).toBe(2)
  })
})

describe('summarizeReviews', () => {
  it('calcula média, total e distribuição', () => {
    const summary = summarizeReviews([{ rating: 5 }, { rating: 5 }, { rating: 4 }, { rating: 2 }])
    expect(summary.total).toBe(4)
    expect(summary.average).toBe(4)
    expect(summary.distribution[0]).toEqual({ rating: 5, count: 2, percent: 50 })
  })
  it('não inventa nota quando não há avaliação', () => {
    const summary = summarizeReviews([])
    expect(summary.total).toBe(0)
    expect(summary.average).toBe(0)
    expect(summary.distribution.every((d) => d.percent === 0)).toBe(true)
  })
  it('descarta nota fora da escala', () => {
    expect(summarizeReviews([{ rating: 0 }, { rating: 9 }, { rating: 5 }]).total).toBe(1)
  })
})

describe('dayMovements', () => {
  it('separa chegadas e saídas do dia, ignorando canceladas', () => {
    const { arrivals, departures } = dayMovements(
      [
        booking('2026-09-16', '2026-09-18'),
        booking('2026-09-12', '2026-09-16'),
        booking('2026-09-16', '2026-09-17', 'cancelled'),
      ],
      '2026-09-16',
    )
    expect(arrivals).toHaveLength(1)
    expect(departures).toHaveLength(1)
  })
})

describe('helpers de data', () => {
  it('formata e desloca datas em UTC', () => {
    expect(toISODate(TODAY)).toBe('2026-09-16')
    expect(addDays('2026-09-16', 5)).toBe('2026-09-21')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })
})

describe('pousadaToday', () => {
  // 23/09/2026 22:30 em Brasília = 24/09/2026 01:30 UTC.
  const NIGHT = new Date('2026-09-24T01:30:00Z')

  it('depois das 21h ainda é hoje na pousada, não amanhã como em UTC', () => {
    expect(toISODate(NIGHT)).toBe('2026-09-24')
    const today = pousadaToday(NIGHT, 'America/Sao_Paulo')
    expect(today.iso).toBe('2026-09-23')
    expect(toISODate(today.date)).toBe('2026-09-23')
  })

  it('chegadas, ocupação e mês do painel usam o dia da pousada', () => {
    const today = pousadaToday(new Date('2026-10-01T01:30:00Z'), 'America/Sao_Paulo')
    const bookings = [booking('2026-09-30', '2026-10-02', 'confirmed', 500)]
    expect(dayMovements(bookings, today.iso).arrivals).toHaveLength(1)
    expect(
      calculateOccupancy(bookings, 1, today.iso, addDays(today.iso, 7), today.date)
        .roomsOccupiedToday,
    ).toBe(1)
    const revenue = monthlyRevenue(bookings, today.date)
    expect(revenue.at(-1)).toEqual({ label: 'set', value: 500 })
  })
})

describe('upcomingReservations', () => {
  it('lista as próximas entradas a partir de hoje, sem canceladas nem encerradas', () => {
    const list = [
      booking('2026-01-10', '2026-01-12', 'checked_out'),
      booking('2026-02-01', '2026-02-03', 'cancelled'),
      booking('2026-09-20', '2026-09-22', 'no_show'),
      booking('2026-10-05', '2026-10-07', 'pending'),
      booking('2026-09-16', '2026-09-18', 'checked_in'),
      booking('2026-09-30', '2026-10-02', 'confirmed'),
      booking('2026-09-17', '2026-09-19', 'cancelled'),
    ]
    expect(upcomingReservations(list, '2026-09-16').map((b) => b.checkin)).toEqual([
      '2026-09-16',
      '2026-09-30',
      '2026-10-05',
    ])
  })

  it('respeita o limite', () => {
    const list = ['2026-09-20', '2026-09-18', '2026-09-22', '2026-09-19'].map((d) =>
      booking(d, addDays(d, 1)),
    )
    expect(upcomingReservations(list, '2026-09-16', 2).map((b) => b.checkin)).toEqual([
      '2026-09-18',
      '2026-09-19',
    ])
  })
})

describe('isAwaitingArrival', () => {
  it('só pendente e confirmada ainda vão chegar', () => {
    expect(isAwaitingArrival('pending')).toBe(true)
    expect(isAwaitingArrival('confirmed')).toBe(true)
    expect(isAwaitingArrival('checked_in')).toBe(false)
    expect(isAwaitingArrival('checked_out')).toBe(false)
    expect(isAwaitingArrival('quote')).toBe(false)
  })
})
