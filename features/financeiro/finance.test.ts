import { describe, it, expect } from 'vitest'
import { buildSummary } from './finance'

describe('buildSummary', () => {
  it('separa receita realizada de a receber', () => {
    const s = buildSummary(
      [
        { total: 1000, status: 'confirmada' },
        { total: 500, status: 'aguardando_pagamento' },
        { total: 300, status: 'cancelada' },
      ],
      [],
    )
    expect(s.revenueConfirmed).toBe(1000)
    expect(s.revenuePending).toBe(500)
    expect(s.revenueTotal).toBe(1500)
  })

  it('ignora reservas canceladas/expiradas na receita', () => {
    const s = buildSummary(
      [
        { total: 800, status: 'no_show' },
        { total: 200, status: 'expirada' },
      ],
      [],
    )
    expect(s.revenueTotal).toBe(0)
  })

  it('soma despesas e calcula pendentes e saldo', () => {
    const s = buildSummary(
      [{ total: 1000, status: 'concluida' }],
      [
        { amount: 300, paid: true },
        { amount: 200, paid: false },
      ],
    )
    expect(s.expensesTotal).toBe(500)
    expect(s.expensesPending).toBe(200)
    expect(s.balance).toBe(500) // 1000 realizado - 500 despesas
  })
})
