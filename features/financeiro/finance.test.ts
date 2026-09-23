import { describe, it, expect } from 'vitest'
import { buildSummary, countsAsRevenue } from './finance'

describe('buildSummary', () => {
  it('separa receita realizada de a receber (status do enum do banco, em inglês)', () => {
    const s = buildSummary(
      [
        { total: 1000, status: 'confirmed' },
        { total: 500, status: 'pending' },
        { total: 300, status: 'cancelled' },
      ],
      [],
    )
    expect(s.revenueConfirmed).toBe(1000)
    expect(s.revenuePending).toBe(500)
    expect(s.revenueTotal).toBe(1500)
  })

  it('em estadia e concluída contam como realizada', () => {
    const s = buildSummary(
      [
        { total: 400, status: 'checked_in' },
        { total: 600, status: 'checked_out' },
      ],
      [],
    )
    expect(s.revenueConfirmed).toBe(1000)
  })

  it('ignora cotação, cancelada e no-show na receita', () => {
    const s = buildSummary(
      [
        { total: 800, status: 'no_show' },
        { total: 200, status: 'cancelled' },
        { total: 150, status: 'quote' },
      ],
      [],
    )
    expect(s.revenueTotal).toBe(0)
  })

  it('não reconhece rótulos em português — a regressão que zerava o painel', () => {
    const s = buildSummary([{ total: 1000, status: 'confirmada' }], [])
    expect(s.revenueTotal).toBe(0)
  })

  it('soma despesas e calcula pendentes e saldo', () => {
    const s = buildSummary(
      [{ total: 1000, status: 'checked_out' }],
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

describe('buildSummary — consumo', () => {
  it('consumo da conta do hóspede entra na receita da reserva', () => {
    const s = buildSummary(
      [
        { total: 1000, chargesAmount: 45.5, status: 'checked_out' },
        { total: 500, chargesAmount: 0, status: 'pending' },
      ],
      [],
    )
    expect(s.revenueConfirmed).toBe(1045.5)
    expect(s.revenuePending).toBe(500)
  })
})
