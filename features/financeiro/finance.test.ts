import { describe, it, expect } from 'vitest'
import { buildSummary, countsAsRevenue } from './finance'

describe('buildSummary (pelo dinheiro, não pelo status)', () => {
  it('confirmada com sinal pago: recebido é o sinal, o resto fica a receber', () => {
    const s = buildSummary([{ total: 1000, received: 300, status: 'confirmed' }], [])
    expect(s.revenueConfirmed).toBe(300)
    expect(s.revenuePending).toBe(700)
    expect(s.revenueTotal).toBe(1000)
  })

  it('pendente sem pagamento: tudo a receber', () => {
    const s = buildSummary([{ total: 500, received: 0, status: 'pending' }], [])
    expect(s.revenueConfirmed).toBe(0)
    expect(s.revenuePending).toBe(500)
  })

  it('cancelada: nada a receber, mas o que entrou continua no caixa', () => {
    const s = buildSummary(
      [
        { total: 800, received: 0, status: 'cancelled' },
        { total: 600, received: 200, status: 'cancelled' },
        { total: 400, received: 0, status: 'no_show' },
      ],
      [],
    )
    expect(s.revenuePending).toBe(0)
    expect(s.revenueConfirmed).toBe(200)
  })

  it('ignora cotação', () => {
    expect(buildSummary([{ total: 150, received: 0, status: 'quote' }], []).revenueTotal).toBe(0)
  })

  it('saldo em caixa desconta só despesas já pagas', () => {
    const s = buildSummary(
      [{ total: 1000, received: 1000, status: 'checked_out' }],
      [
        { amount: 300, paid: true },
        { amount: 200, paid: false },
      ],
    )
    expect(s.expensesTotal).toBe(500)
    expect(s.expensesPending).toBe(200)
    expect(s.balance).toBe(700) // 1000 recebido - 300 pagos
  })
})

describe('countsAsRevenue', () => {
  it('só realizada e a receber entram no extrato', () => {
    expect(countsAsRevenue('pending')).toBe(true)
    expect(countsAsRevenue('confirmed')).toBe(true)
    expect(countsAsRevenue('checked_in')).toBe(true)
    expect(countsAsRevenue('checked_out')).toBe(true)
    expect(countsAsRevenue('quote')).toBe(false)
    expect(countsAsRevenue('cancelled')).toBe(false)
    expect(countsAsRevenue('no_show')).toBe(false)
  })
})
