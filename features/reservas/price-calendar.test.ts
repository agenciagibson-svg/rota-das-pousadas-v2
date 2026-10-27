import { describe, expect, it } from 'vitest'
import {
  buildCalendarMonth,
  canCheckoutOn,
  clampMonth,
  formatCalendarPrice,
  indexCalendarDays,
  monthRange,
  monthTitle,
  nextSelection,
  requiredMinNights,
  selectionHint,
  shiftMonth,
  type CalendarCell,
  type PriceCalendarDay,
} from './price-calendar'

// Novembro de 2026 começa num domingo. "Hoje" = 03/11.
const TODAY = '2026-11-03'

function day(date: string, fromPrice: number | null, minNights = 1): PriceCalendarDay {
  return { date, fromPrice, available: fromPrice !== null, minNights }
}

const days = indexCalendarDays([
  day('2026-11-03', 200),
  day('2026-11-04', 200),
  day('2026-11-05', null), // lotado
  day('2026-11-06', 300),
  day('2026-11-07', 300),
  day('2026-11-13', 500, 3), // feriado com mínimo de 3
  day('2026-11-14', 500, 3),
  day('2026-11-15', 500, 3),
  day('2026-11-16', 200),
  day('2026-11-12', 250),
])

function cell(month: ReturnType<typeof buildCalendarMonth>, date: string): CalendarCell {
  const found = month.weeks.flat().find((c) => c?.date === date)
  if (!found) throw new Error(`sem célula ${date}`)
  return found
}

describe('meses', () => {
  it('navega entre meses e anos', () => {
    expect(shiftMonth('2026-11', 1)).toBe('2026-12')
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
  })

  it('consulta o mês inteiro com fim exclusivo', () => {
    expect(monthRange('2026-12')).toEqual({ from: '2026-12-01', to: '2027-01-01' })
  })

  it('não volta antes do mês de hoje nem vai longe demais', () => {
    expect(clampMonth('2026-10', TODAY)).toBe('2026-11')
    expect(clampMonth('lixo', TODAY)).toBe('2026-11')
    expect(clampMonth('2030-01', TODAY)).toBe('2028-09')
    expect(clampMonth('2027-02', TODAY)).toBe('2027-02')
  })

  it('título em português com maiúscula', () => {
    expect(monthTitle('2026-11')).toBe('Novembro de 2026')
  })
})

describe('buildCalendarMonth', () => {
  const empty = { checkin: '', checkout: '' }
  const month = buildCalendarMonth({ month: '2026-11', days, today: TODAY, selection: empty })

  it('monta semanas de domingo a sábado com todos os dias do mês', () => {
    expect(month.title).toBe('Novembro de 2026')
    expect(month.weeks.every((w) => w.length === 7)).toBe(true)
    expect(month.weeks[0][0]?.date).toBe('2026-11-01') // domingo
    expect(month.weeks.flat().filter(Boolean)).toHaveLength(30)
  })

  it('preenche com vazio os dias de outro mês', () => {
    const dec = buildCalendarMonth({ month: '2026-12', days: {}, today: TODAY, selection: empty })
    expect(dec.weeks[0].slice(0, 2)).toEqual([null, null]) // 01/12/2026 é terça
    expect(dec.weeks[0][2]?.date).toBe('2026-12-01')
  })

  it('mostra a diária "a partir de" e o mínimo', () => {
    expect(cell(month, '2026-11-06')).toMatchObject({
      price: 300,
      status: 'available',
      selectable: true,
    })
    expect(cell(month, '2026-11-13')).toMatchObject({ price: 500, minNights: 3 })
    expect(cell(month, '2026-11-13').label).toContain('estadia mínima de 3 noites')
    expect(cell(month, '2026-11-13').label).toContain('a partir de R$ 500')
  })

  it('desabilita passado e noite sem vaga', () => {
    expect(cell(month, '2026-11-02')).toMatchObject({
      status: 'past',
      selectable: false,
      price: null,
    })
    expect(cell(month, '2026-11-05')).toMatchObject({ status: 'unavailable', selectable: false })
    expect(cell(month, '2026-11-05').label).toContain('sem vaga')
  })

  it('dia sem dado fica clicável e sem preço (o servidor confere depois)', () => {
    expect(cell(month, '2026-11-20')).toMatchObject({
      status: 'unknown',
      price: null,
      selectable: true,
    })
  })

  it('escolhendo a saída: só libera saídas possíveis', () => {
    const picking = buildCalendarMonth({
      month: '2026-11',
      days,
      today: TODAY,
      selection: { checkin: '2026-11-03', checkout: '' },
    })
    expect(cell(picking, '2026-11-03').isCheckin).toBe(true)
    expect(cell(picking, '2026-11-04').selectable).toBe(true)
    // A noite de 05 está lotada, mas sair no dia 05 é possível.
    expect(cell(picking, '2026-11-05').selectable).toBe(true)
    expect(cell(picking, '2026-11-06').selectable).toBe(false)
  })

  it('marca a estadia escolhida', () => {
    const chosen = buildCalendarMonth({
      month: '2026-11',
      days,
      today: TODAY,
      selection: { checkin: '2026-11-12', checkout: '2026-11-16' },
    })
    expect(cell(chosen, '2026-11-12').isCheckin).toBe(true)
    expect(cell(chosen, '2026-11-16').isCheckout).toBe(true)
    expect(['13', '14', '15'].map((d) => cell(chosen, `2026-11-${d}`).inRange)).toEqual([
      true,
      true,
      true,
    ])
    expect(cell(chosen, '2026-11-12').inRange).toBe(false)
  })
})

describe('estadia mínima', () => {
  it('vale a maior entre as noites do período', () => {
    expect(requiredMinNights('2026-11-12', '2026-11-14', days)).toBe(3)
    expect(requiredMinNights('2026-11-03', '2026-11-05', days)).toBe(1)
  })

  it('chegar antes do feriado não fura o mínimo', () => {
    expect(canCheckoutOn('2026-11-12', '2026-11-14', TODAY, days)).toBe(false)
    expect(canCheckoutOn('2026-11-12', '2026-11-15', TODAY, days)).toBe(true)
  })

  it('respeita o teto de noites do site', () => {
    expect(canCheckoutOn('2026-11-20', '2026-11-25', TODAY, {}, 4)).toBe(false)
    expect(canCheckoutOn('2026-11-20', '2026-11-24', TODAY, {}, 4)).toBe(true)
  })
})

describe('nextSelection', () => {
  const empty = { checkin: '', checkout: '' }

  it('primeiro clique escolhe a entrada', () => {
    expect(nextSelection(empty, '2026-11-06', TODAY, days)).toEqual({
      checkin: '2026-11-06',
      checkout: '',
    })
  })

  it('ignora clique em dia sem vaga ou passado', () => {
    expect(nextSelection(empty, '2026-11-05', TODAY, days)).toBe(empty)
    expect(nextSelection(empty, '2026-11-01', TODAY, days)).toBe(empty)
  })

  it('segundo clique depois da entrada escolhe a saída', () => {
    const start = { checkin: '2026-11-06', checkout: '' }
    expect(nextSelection(start, '2026-11-08', TODAY, days)).toEqual({
      checkin: '2026-11-06',
      checkout: '2026-11-08',
    })
  })

  it('saída impossível não muda nada', () => {
    const start = { checkin: '2026-11-03', checkout: '' }
    expect(nextSelection(start, '2026-11-07', TODAY, days)).toBe(start)
  })

  it('clique antes da entrada troca a entrada', () => {
    const start = { checkin: '2026-11-06', checkout: '' }
    expect(nextSelection(start, '2026-11-04', TODAY, days)).toEqual({
      checkin: '2026-11-04',
      checkout: '',
    })
  })

  it('entrada que lotou ou passou não prende a escolha', () => {
    const stale = { checkin: '2026-11-05', checkout: '' }
    expect(nextSelection(stale, '2026-11-06', TODAY, days)).toEqual({
      checkin: '2026-11-06',
      checkout: '',
    })
    const past = { checkin: '2026-11-01', checkout: '' }
    const month = buildCalendarMonth({ month: '2026-11', days, today: TODAY, selection: past })
    expect(cell(month, '2026-11-06').selectable).toBe(true)
  })

  it('com as duas datas escolhidas, o clique recomeça', () => {
    const done = { checkin: '2026-11-03', checkout: '2026-11-04' }
    expect(nextSelection(done, '2026-11-12', TODAY, days)).toEqual({
      checkin: '2026-11-12',
      checkout: '',
    })
  })
})

describe('textos', () => {
  it('preço curto na célula', () => {
    expect(formatCalendarPrice(450)).toBe('450')
    expect(formatCalendarPrice(1200)).toBe('1.200')
    expect(formatCalendarPrice(12_400)).toBe('12 mil')
  })

  it('dica conforme a etapa', () => {
    expect(selectionHint({ checkin: '', checkout: '' }, TODAY, days)).toBe(
      'Toque no dia da entrada.',
    )
    expect(selectionHint({ checkin: '2026-11-13', checkout: '' }, TODAY, days)).toContain(
      'mínima é de 3',
    )
    expect(selectionHint({ checkin: '2026-11-03', checkout: '2026-11-05' }, TODAY, days)).toContain(
      '2 noites',
    )
    expect(selectionHint({ checkin: '2026-11-05', checkout: '' }, TODAY, days)).toContain(
      'não está mais disponível',
    )
  })
})
