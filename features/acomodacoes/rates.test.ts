import { describe, expect, it } from 'vitest'
import {
  describeAdjustment,
  describePeriod,
  describeWeekdays,
  isPastRule,
  previewNightly,
} from './rates'

describe('regras de tarifa', () => {
  it('descreve o período em noites', () => {
    expect(describePeriod({ firstNight: '2026-12-20', lastNight: '2027-01-05' })).toBe(
      'Noites de 20/12/2026 a 05/01/2027',
    )
    expect(describePeriod({ firstNight: '2026-12-31', lastNight: '2026-12-31' })).toBe(
      'Noite de 31/12/2026',
    )
  })

  it('descreve os dias da semana', () => {
    expect(describeWeekdays(null)).toBe('Todos os dias')
    expect(describeWeekdays([6, 5])).toBe('Sex e Sáb')
    expect(describeWeekdays([0])).toBe('Só Dom')
    expect(describeWeekdays([0, 1, 2, 3, 4, 5, 6])).toBe('Todos os dias')
  })

  it('descreve o ajuste', () => {
    expect(describeAdjustment({ kind: 'fixed', value: 650 })).toMatch(/Diária de R\$\s?650,00/)
    expect(describeAdjustment({ kind: 'percent', value: 50 })).toBe('+50% sobre a diária')
    expect(describeAdjustment({ kind: 'percent', value: -10 })).toBe('−10% sobre a diária')
  })

  it('calcula a diária de exemplo como o banco', () => {
    expect(previewNightly(400, { kind: 'percent', value: 50 })).toBe(600)
    expect(previewNightly(333, { kind: 'percent', value: 10 })).toBe(366)
    expect(previewNightly(400, { kind: 'fixed', value: 650 })).toBe(650)
    expect(previewNightly(100, { kind: 'percent', value: -90 })).toBe(10)
  })

  it('marca regra que já passou', () => {
    expect(isPastRule({ lastNight: '2026-01-01' }, '2026-10-23')).toBe(true)
    expect(isPastRule({ lastNight: '2026-10-23' }, '2026-10-23')).toBe(false)
  })
})
