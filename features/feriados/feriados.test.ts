import { describe, expect, it } from 'vitest'
import {
  easter,
  formatHolidayDate,
  formatRange,
  holidaysOf,
  longWeekend,
  searchHref,
  upcomingLongWeekends,
} from './feriados'

describe('feriados', () => {
  it('calcula a Páscoa', () => {
    expect(easter(2026)).toBe('2026-04-05')
    expect(easter(2027)).toBe('2027-03-28')
    expect(easter(2025)).toBe('2025-04-20')
  })

  it('datas móveis de 2027', () => {
    const h = Object.fromEntries(holidaysOf(2027).map((x) => [x.slug, x.date]))
    expect(h.carnaval).toBe('2027-02-09')
    expect(h['sexta-feira-santa']).toBe('2027-03-26')
    expect(h['corpus-christi']).toBe('2027-05-27')
    expect(h['consciencia-negra']).toBe('2027-11-20')
  })

  it('feriado na terça emenda a segunda; na quinta, a sexta', () => {
    // 21/04/2026 é terça.
    const tir = longWeekend({ slug: 'tiradentes', name: 'Tiradentes', date: '2026-04-21' })
    expect(tir).toMatchObject({
      offStart: '2026-04-18',
      offEnd: '2026-04-21',
      checkin: '2026-04-17',
      checkout: '2026-04-21',
      nights: 4,
      bridge: true,
    })
    // Corpus Christi 2027 é quinta.
    const cc = longWeekend({ slug: 'corpus-christi', name: 'Corpus Christi', date: '2027-05-27' })
    expect(cc).toMatchObject({
      offStart: '2027-05-27',
      offEnd: '2027-05-30',
      nights: 4,
      bridge: true,
    })
  })

  it('Carnaval vai de sábado a terça', () => {
    const c = longWeekend({ slug: 'carnaval', name: 'Carnaval', date: '2027-02-09' })
    expect(c).toMatchObject({ offStart: '2027-02-06', checkin: '2027-02-05', nights: 4 })
  })

  it('próximos feriadões pulam os de quarta e os que já passaram', () => {
    const list = upcomingLongWeekends('2026-11-21', 3)
    // 20/11/2026 (sexta) já passou no dia 23; ainda conta até o domingo 22.
    expect(list[0]!.slug).toBe('consciencia-negra')
    expect(list.every((w) => w.nights >= 2)).toBe(true)
    // Natal 2026 é sexta.
    expect(list[1]).toMatchObject({ slug: 'natal', checkin: '2026-12-24', checkout: '2026-12-27' })
  })

  it('formata datas e monta a busca', () => {
    expect(formatHolidayDate('2026-04-21')).toBe('21 de abril (terça)')
    expect(formatRange('2026-04-18', '2026-04-21')).toBe('sábado, 18 a terça, 21 de abril')
    expect(formatRange('2027-01-30', '2027-02-02')).toBe(
      'sábado, 30 de janeiro a terça, 2 de fevereiro',
    )
    const w = longWeekend({ slug: 'natal', name: 'Natal', date: '2026-12-25' })
    expect(searchHref(w, 'Tiradentes')).toBe(
      '/pousadas?checkin=2026-12-24&checkout=2026-12-27&busca=Tiradentes',
    )
  })
})
