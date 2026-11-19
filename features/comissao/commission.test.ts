import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PLATFORM_COMMISSION_RATE } from '@/lib/platform-commission'
import {
  findMonth,
  monthLabel,
  monthParam,
  parseMonthParam,
  rateLabel,
  sumCommissionMonths,
} from './commission'

describe('mês do extrato', () => {
  it('aceita só AAAA-MM vindo da URL', () => {
    expect(parseMonthParam('2026-12')).toBe('2026-12-01')
    expect(parseMonthParam('2026-01')).toBe('2026-01-01')
    for (const bad of ['2026-13', '2026-00', '2026-1', '26-12', '2026-12-01', "2026-12'; --", ''])
      expect(parseMonthParam(bad)).toBeNull()
    expect(parseMonthParam(undefined)).toBeNull()
    expect(parseMonthParam(null)).toBeNull()
    expect(parseMonthParam(['2026-12', '2026-11'])).toBeNull()
  })

  it('vai e volta entre a URL e o primeiro dia do mês', () => {
    expect(monthParam('2026-12-01')).toBe('2026-12')
    expect(parseMonthParam(monthParam('2027-03-01'))).toBe('2027-03-01')
  })

  it('nome do mês não escorrega de dia por causa do fuso', () => {
    expect(monthLabel('2026-12-01')).toBe('dezembro de 2026')
    expect(monthLabel('2027-01-01')).toBe('janeiro de 2027')
    expect(monthLabel('não é data')).toBe('não é data')
  })
})

describe('percentual e totais', () => {
  it('escreve o percentual como aparece no contrato', () => {
    expect(rateLabel(0.06)).toBe('6%')
    expect(rateLabel(0.065)).toBe('6,5%')
    expect(rateLabel(0)).toBe('0%')
  })

  it('soma os meses em centavos, sem erro de ponto flutuante', () => {
    const months = [
      { month: '2026-12-01', bookings: 2, base: 1335, due: 80.1, waived: 0 },
      { month: '2027-01-01', bookings: 1, base: 450, due: 27.2, waived: 60 },
      { month: '2027-02-01', bookings: 3, base: 0.3, due: 0.1, waived: 0.2 },
    ]
    expect(sumCommissionMonths(months)).toEqual({
      bookings: 6,
      base: 1785.3,
      due: 107.4,
      waived: 60.2,
    })
    expect(sumCommissionMonths([])).toEqual({ bookings: 0, base: 0, due: 0, waived: 0 })
  })

  it('acha o mês aberto e devolve null quando ele não tem comissão', () => {
    const months = [{ month: '2026-12-01', bookings: 1, base: 100, due: 6, waived: 0 }]
    expect(findMonth(months, '2026-12-01')?.due).toBe(6)
    expect(findMonth(months, '2026-11-01')).toBeNull()
  })
})

describe('percentual único', () => {
  it('o percentual do banco (0104) é o mesmo dos textos do site', () => {
    const sql = readFileSync(
      join(process.cwd(), 'supabase/migrations/0104_comissao_registro.sql'),
      'utf8',
    )
    const match =
      /create or replace function platform_commission_rate\(\)[\s\S]*?select ([0-9.]+)::numeric/.exec(
        sql,
      )
    expect(match).not.toBeNull()
    expect(Number(match?.[1])).toBe(PLATFORM_COMMISSION_RATE)
  })
})
