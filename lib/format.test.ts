import { describe, expect, it } from 'vitest'
import { formatBRL, formatDateTime, formatISODate, isEmail, plural, whatsappLink } from './format'

describe('format', () => {
  it('formata reais', () => {
    expect(formatBRL(1440)).toBe('R$ 1.440,00')
    expect(formatBRL(0)).toBe('R$ 0,00')
    expect(formatBRL(59.9)).toBe('R$ 59,90')
    expect(formatBRL(null)).toBe('R$ 0,00')
    expect(formatBRL(Number.NaN)).toBe('R$ 0,00')
  })

  it('data ISO sem fuso', () => {
    expect(formatISODate('2026-10-16')).toBe('16/10/2026')
    expect(formatISODate(null)).toBe('—')
  })

  it('data e hora sempre em Brasília', () => {
    expect(formatDateTime('2026-09-27T02:31:00Z')).toBe('26/09/2026, 23:31')
    expect(formatDateTime('lixo')).toBe('—')
  })

  it('plural e e-mail', () => {
    expect(plural(1, 'noite', 'noites')).toBe('1 noite')
    expect(plural(2, 'noite', 'noites')).toBe('2 noites')
    expect(isEmail('a@b.com')).toBe(true)
    expect(isEmail('E-mail não informado')).toBe(false)
  })
})

describe('whatsappLink', () => {
  it('adiciona o DDI do Brasil', () => {
    expect(whatsappLink('(55) 99999-1234')).toBe('https://wa.me/5555999991234')
    expect(whatsappLink('+55 35 99999-1234')).toBe('https://wa.me/5535999991234')
    expect(whatsappLink('123')).toBeNull()
  })
})
