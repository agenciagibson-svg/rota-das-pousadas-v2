import { describe, expect, it } from 'vitest'
import { buildDemoOwnerDashboard, demoOwnerReservations } from './demo'

const NOW = new Date('2026-10-13T15:00:00Z')

describe('painel da pousada — demonstração', () => {
  it('reservas sintéticas: e-mails fictícios e nenhum telefone', () => {
    const list = demoOwnerReservations('2026-10-13')
    expect(list.length).toBeGreaterThan(20)
    expect(list.every((r) => r.guestEmail.endsWith('@exemplo.com.br'))).toBe(true)
    expect(list.every((r) => !r.guestPhone)).toBe(true)
    expect(new Set(list.map((r) => r.id)).size).toBe(list.length)
  })

  it('métricas saem das funções do painel real, com movimento hoje', () => {
    const d = buildDemoOwnerDashboard(NOW)
    expect(d.arrivalsToday.length).toBe(2)
    expect(d.departuresToday.length).toBeGreaterThan(0)
    expect(d.occupancy!.rate).toBeGreaterThan(0)
    expect(d.revenueSeries.some((p) => p.value > 0)).toBe(true)
    expect(d.reviews.total).toBeGreaterThan(0)
    expect(d.upcomingReservations.length).toBeGreaterThan(0)
  })
})
