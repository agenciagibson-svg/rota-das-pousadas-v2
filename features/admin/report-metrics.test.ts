import { describe, expect, it } from 'vitest'
import {
  buildReport,
  nightsInside,
  periodWindows,
  regionOf,
  type ReportBooking,
} from './report-metrics'

const now = new Date('2026-09-28T15:00:00Z')
const P = (id: string, state: string, createdAt = '2026-01-01T00:00:00Z') => ({
  id,
  slug: id,
  name: `Pousada ${id}`,
  city: `Cidade ${id}`,
  state,
  status: 'publicada',
  createdAt,
})
const B = (
  pousadaId: string,
  createdAt: string,
  total: number,
  status = 'confirmed',
  checkin = '2026-09-20',
  checkout = '2026-09-22',
  origin = 'rota_das_pousadas',
): ReportBooking => ({
  pousadaId,
  status,
  origin,
  total,
  checkin,
  checkout,
  createdAt,
})

describe('relatórios do master', () => {
  it('janelas do período e recorte de noites', () => {
    const { current, previous } = periodWindows('30d', now)
    expect(current.days).toBe(30)
    expect(current.end.toISOString()).toBe('2026-09-29T00:00:00.000Z')
    expect(previous.end.getTime()).toBe(current.start.getTime())
    expect(nightsInside('2026-08-28', '2026-09-02', current)).toBe(3) // 30/08, 31/08, 01/09
    expect(regionOf('mg')).toBe('Sudeste')
    expect(regionOf('XX')).toBeNull()
  })

  it('volume usa o total da reserva, compara com o período anterior e agrupa por região', () => {
    const sales = [
      B('a', '2026-09-10T10:00:00Z', 1440),
      B('a', '2026-09-12T10:00:00Z', 720, 'cancelled'),
      B('b', '2026-09-15T10:00:00Z', 600, 'checked_out', '2026-09-16', '2026-09-18', 'whatsapp'),
      B('a', '2026-08-15T10:00:00Z', 720), // período anterior
      B('a', '2026-09-01T10:00:00Z', 999, 'quote'), // cotação não conta
    ]
    const r = buildReport({
      period: '30d',
      now,
      sales,
      stays: sales.filter((s) => ['confirmed', 'checked_in', 'checked_out'].includes(s.status)),
      pousadas: [P('a', 'MG'), P('b', 'BA'), P('c', 'RS'), P('d', 'SP', '2026-09-20T00:00:00Z')],
      roomsByPousada: { a: 2, b: 1, c: 1, d: 1 },
      reviews: [{ pousadaId: 'a', rating: 5, createdAt: '2026-09-25T00:00:00Z' }],
    })
    expect(r.kpis.volume.value).toBe(2040)
    expect(r.kpis.volume.previous).toBe(720)
    expect(r.kpis.bookings.value).toBe(2)
    expect(r.kpis.avgTicket.value).toBe(1020)
    expect(r.kpis.cancelRate.value).toBe(33.3)
    expect(r.kpis.rating).toEqual({ value: 5, count: 1 })
    expect(r.regions.map((g) => g.key)).toEqual([
      'Sudeste',
      'Sul',
      'Nordeste',
      'Centro-Oeste',
      'Norte',
    ])
    expect(r.regions.find((g) => g.key === 'Sudeste')!.volume).toBe(1440)
    expect(r.states[0]!.label).toBe('MG')
    expect(r.origins.map((o) => o.key)).toEqual(['rota_das_pousadas', 'whatsapp'])
    const byId = Object.fromEntries(r.pousadas.map((p) => [p.id, p]))
    expect(byId.a!.status).toBe('crescendo')
    expect(byId.c!.status).toBe('sem_resultado')
    expect(byId.d!.status).toBe('nova')
    expect(byId.a!.nights).toBe(4) // 2 reservas de 2 noites dentro do período (a do mês anterior também cai em 20–22/09)
    expect(r.alerts.some((a) => a.pousada === 'Pousada c')).toBe(true)
    expect(r.series.reduce((s, p) => s + p.volume, 0)).toBe(2040)
  })
})
