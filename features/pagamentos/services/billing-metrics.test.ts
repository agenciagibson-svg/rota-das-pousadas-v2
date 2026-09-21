import { describe, expect, it } from 'vitest'
import { computeBillingMetrics, projectCashFlow } from './billing-metrics'

const NOW = new Date('2026-09-20T12:00:00Z')

describe('computeBillingMetrics', () => {
  it('soma o MRR só das assinaturas autorizadas', () => {
    const result = computeBillingMetrics(
      [
        {
          status: 'authorized',
          price: 59.9,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
        {
          status: 'authorized',
          price: 59.9,
          createdAt: '2026-02-01T00:00:00Z',
          updatedAt: '2026-02-01T00:00:00Z',
        },
        {
          status: 'pending',
          price: 59.9,
          createdAt: '2026-09-10T00:00:00Z',
          updatedAt: '2026-09-10T00:00:00Z',
        },
      ],
      NOW,
    )
    expect(result.mrr).toBe(119.8)
    expect(result.activeCount).toBe(2)
  })

  it('conta nova assinatura do mês (criada no mês corrente, não cancelada)', () => {
    const result = computeBillingMetrics(
      [
        {
          status: 'pending',
          price: 59.9,
          createdAt: '2026-09-15T00:00:00Z',
          updatedAt: '2026-09-15T00:00:00Z',
        },
        {
          status: 'authorized',
          price: 59.9,
          createdAt: '2026-08-01T00:00:00Z',
          updatedAt: '2026-08-01T00:00:00Z',
        },
      ],
      NOW,
    )
    expect(result.newThisMonth).toBe(1)
  })

  it('não conta como nova uma assinatura criada este mês que já foi cancelada', () => {
    const result = computeBillingMetrics(
      [
        {
          status: 'cancelled',
          price: 59.9,
          createdAt: '2026-09-05T00:00:00Z',
          updatedAt: '2026-09-18T00:00:00Z',
        },
      ],
      NOW,
    )
    expect(result.newThisMonth).toBe(0)
    expect(result.cancelledThisMonth).toBe(1)
  })

  it('calcula churn do mês sobre a base de ativas + canceladas no mês', () => {
    const result = computeBillingMetrics(
      [
        {
          status: 'authorized',
          price: 59.9,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
        {
          status: 'authorized',
          price: 59.9,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
        {
          status: 'authorized',
          price: 59.9,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
        {
          status: 'cancelled',
          price: 59.9,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-09-10T00:00:00Z',
        },
      ],
      NOW,
    )
    // base = 3 ativas + 1 cancelada este mês = 4; churn = 1/4 = 25%
    expect(result.churnRatePct).toBe(25)
  })

  it('devolve churn nulo quando não há base (nenhuma assinatura ativa nem cancelada no mês)', () => {
    const result = computeBillingMetrics([], NOW)
    expect(result.churnRatePct).toBeNull()
    expect(result.mrr).toBe(0)
  })
})

describe('projectCashFlow', () => {
  it('projeta o MRR atual constante pelos próximos meses', () => {
    const points = projectCashFlow(119.8, 3, NOW)
    expect(points).toHaveLength(3)
    expect(points.every((p) => p.projected === 119.8)).toBe(true)
    expect(points[0].month).toBe('2026-09')
    expect(points[1].month).toBe('2026-10')
    expect(points[2].month).toBe('2026-11')
  })
})
