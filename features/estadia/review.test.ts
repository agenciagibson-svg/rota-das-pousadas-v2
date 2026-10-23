import { describe, expect, it } from 'vitest'
import { parseRatingParam, reviewAvailability, reviewPagePath } from './review'

describe('nota vinda do link do e-mail (?nota=N)', () => {
  it.each(['1', '2', '3', '4', '5'])('"%s" pré-seleciona a nota', (value) => {
    expect(parseRatingParam(value)).toBe(Number(value))
  })

  it('aceita espaço em volta (cliente de e-mail que quebra o link)', () => {
    expect(parseRatingParam(' 4 ')).toBe(4)
  })

  it.each([
    ['ausente', undefined],
    ['nulo', null],
    ['vazio', ''],
    ['zero', '0'],
    ['seis', '6'],
    ['negativo', '-1'],
    ['decimal', '4.5'],
    ['com zero à esquerda', '05'],
    ['texto', 'cinco'],
    ['dígito seguido de lixo', '5abc'],
    ['parâmetro repetido', ['5', '1']],
  ])('%s → sem pré-seleção', (_label, value) => {
    expect(parseRatingParam(value)).toBeNull()
  })
})

describe('caminho da página de avaliação', () => {
  const id = '30000000-0000-0000-0000-000000008901'
  it('com e sem nota', () => {
    expect(reviewPagePath(id)).toBe(`/minhas-reservas/${id}/avaliar`)
    expect(reviewPagePath(id, 3)).toBe(`/minhas-reservas/${id}/avaliar?nota=3`)
  })
})

describe('o que a página de avaliação mostra', () => {
  const base = {
    canReview: false,
    reviewed: false,
    status: 'checked_out',
    today: '2026-10-23',
    checkout: '2026-10-22',
  }
  it('pode avaliar', () => {
    expect(reviewAvailability({ ...base, canReview: true })).toBe('available')
  })
  it('já avaliou tem prioridade', () => {
    expect(reviewAvailability({ ...base, canReview: true, reviewed: true })).toBe('reviewed')
  })
  it('estadia ainda não acabou', () => {
    expect(reviewAvailability({ ...base, status: 'confirmed', checkout: '2026-10-25' })).toBe(
      'not_yet',
    )
  })
  it('encerrada sem direito a avaliar (balcão, outro canal, cancelada)', () => {
    expect(reviewAvailability(base)).toBe('not_eligible')
    expect(reviewAvailability({ ...base, status: 'cancelled', checkout: '2026-10-25' })).toBe(
      'not_eligible',
    )
  })
})
