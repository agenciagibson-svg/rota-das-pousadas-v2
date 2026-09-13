import { describe, expect, it } from 'vitest'
import { buildHighlights, calculateRates, rate, seriesPeak } from './report'
import type { LinkReport, LinkReportTotals } from './types'

function totals(over: Partial<LinkReportTotals> = {}): LinkReportTotals {
  return {
    views: 0, searches: 0, searchesWithoutAvailability: 0,
    quotes: 0, bookings: 0, revenue: 0, ...over,
  }
}

function report(over: Partial<LinkReport> = {}): LinkReport {
  return {
    days: 30, from: '2026-08-15',
    totals: totals(), daily: [], unmetDemand: [], ...over,
  }
}

describe('rate', () => {
  it('calcula percentual inteiro', () => {
    expect(rate(3, 12)).toBe(25)
    expect(rate(1, 3)).toBe(33)
  })
  it('nunca devolve NaN, Infinity ou acima de 100', () => {
    expect(rate(5, 0)).toBe(0)
    expect(rate(0, 0)).toBe(0)
    expect(rate(20, 10)).toBe(100)
    expect(rate(Number.NaN, 10)).toBe(0)
  })
})

describe('calculateRates', () => {
  it('encadeia visita → busca → conversão', () => {
    const r = calculateRates(totals({ views: 100, searches: 40, bookings: 6, quotes: 2, searchesWithoutAvailability: 10 }))
    expect(r).toEqual({ searchRate: 40, conversionRate: 20, unavailableRate: 25 })
  })
  it('página sem visita nenhuma não quebra', () => {
    expect(calculateRates(totals())).toEqual({ searchRate: 0, conversionRate: 0, unavailableRate: 0 })
  })
})

describe('buildHighlights', () => {
  it('coloca demanda perdida acima de qualquer número bom', () => {
    const hl = buildHighlights(report({
      totals: totals({ views: 200, searches: 60, bookings: 5, revenue: 7400, searchesWithoutAvailability: 14 }),
      unmetDemand: [{ checkin: '2026-11-14', checkout: '2026-11-17', guests: 4, tries: 14 }],
    }))
    expect(hl[0].tone).toBe('atencao')
    expect(hl[0].title).toContain('14 pessoas')
    expect(hl[0].title).toContain('14/11 a 17/11')
    expect(hl[1].title).toContain('5 reservas')
  })

  it('não alarma por uma única busca sem vaga', () => {
    const hl = buildHighlights(report({
      totals: totals({ views: 10, searches: 2, searchesWithoutAvailability: 1, bookings: 1, revenue: 900 }),
      unmetDemand: [{ checkin: '2026-11-14', checkout: '2026-11-17', guests: 2, tries: 1 }],
    }))
    expect(hl.some((h) => h.title.includes('não havia vaga'))).toBe(false)
  })

  it('separa "ninguém consultou" de "consultaram e não fecharam"', () => {
    const semBusca = buildHighlights(report({ totals: totals({ views: 80 }) }))
    expect(semBusca[0].title).toContain('ninguém consultou datas')

    const semReserva = buildHighlights(report({ totals: totals({ views: 80, searches: 30 }) }))
    expect(semReserva[0].title).toContain('ninguém reservou')
  })

  it('aponta disponibilidade como culpada quando metade das buscas não acha vaga', () => {
    const hl = buildHighlights(report({ totals: totals({ views: 80, searches: 30, searchesWithoutAvailability: 20 }) }))
    expect(hl[0].detail).toContain('problema é disponibilidade')
  })

  it('aponta preço quando havia vaga e mesmo assim não fecharam', () => {
    const hl = buildHighlights(report({ totals: totals({ views: 80, searches: 30, searchesWithoutAvailability: 2 }) }))
    expect(hl[0].detail).toContain('diária')
  })

  it('link parado devolve orientação, não tela vazia', () => {
    const hl = buildHighlights(report())
    expect(hl).toHaveLength(1)
    expect(hl[0].title).toContain('Ainda sem movimento')
  })

  it('singular e plural corretos', () => {
    const hl = buildHighlights(report({ totals: totals({ views: 5, searches: 2, bookings: 1, revenue: 500, quotes: 1 }) }))
    expect(hl.some((h) => h.title === '1 reserva veio pelo link')).toBe(true)
    expect(hl.some((h) => h.title === '1 pedido de orçamento')).toBe(true)
  })
})

describe('seriesPeak', () => {
  it('pega o maior valor entre as três séries', () => {
    expect(seriesPeak(report({
      daily: [
        { day: '2026-09-01', views: 12, searches: 4, bookings: 1 },
        { day: '2026-09-02', views: 9, searches: 21, bookings: 0 },
      ],
    }))).toBe(21)
  })
  it('série vazia devolve 0 em vez de -Infinity', () => {
    expect(seriesPeak(report())).toBe(0)
  })
})
